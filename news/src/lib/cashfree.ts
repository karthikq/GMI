import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, connect } from "@/lib/db";
import { sendPlanConfirmEmail } from "@/lib/email";
import { PLANS, type PlanId } from "@/lib/plans";
import { isEditorial } from "@/lib/roles";

// Cashfree Subscriptions (autopay via UPI, card and eNACH mandates). Docs:
// https://www.cashfree.com/docs/payments/subscription — the customer authorises
// the mandate on Cashfree's hosted checkout, opened with the returned
// subscription_session_id, and is sent back to our /subscribe/callback.
export type ReconcileStatus = "success" | "pending" | "failed" | "cancelled";

const API_VERSION = "2025-01-01";

// Hosted checkout + JS SDK mode. Anything but "production" stays on sandbox.
export function cashfreeMode(): "production" | "sandbox" {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

const BASE = () =>
  cashfreeMode() === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

function credentials() {
  const clientId = process.env.CASHFREE_API_KEY;
  const secret = process.env.CASHFREE_API_SECRET;
  if (!clientId || !secret) {
    throw new Error("Payments aren't configured yet — Cashfree keys are missing.");
  }
  return { clientId, secret };
}

async function cfFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const { clientId, secret } = credentials();
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": secret,
      "x-api-version": API_VERSION,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `Cashfree request failed (${res.status}).`);
  }
  return data as T;
}

// Cashfree plan ids are merchant-chosen (gmi-premium, gmi-premium-plus), so we
// create each plan once and remember it in settings — keys are the only setup.
async function ensurePlan(plan: PlanId, name: string, amount: number): Promise<string> {
  const planId = `gmi-${plan}`;
  await connect();
  const key = `cashfreePlan:${planId}`;
  const cached = await collections.settings.findOne({ _id: key });
  if (cached?.value) return planId;
  try {
    await cfFetch(`/plans/${planId}`, { method: "GET" });
  } catch {
    await cfFetch("/plans", {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        plan_name: `GMI ${name}`,
        plan_type: "PERIODIC",
        plan_currency: "INR",
        plan_recurring_amount: amount,
        plan_max_amount: amount,
        plan_intervals: 1,
        plan_interval_type: "MONTH",
        // plan_max_cycles counts debits; 99 years is effectively "until cancelled".
        plan_max_cycles: 1200,
      }),
    });
  }
  await collections.settings.updateOne({ _id: key }, { $set: { value: planId } }, { upsert: true });
  return planId;
}

// Creates a Cashfree subscription and records it on the user so the callback
// and the webhook can match the mandate back to this account.
export async function createCashfreeSubscription(args: {
  userId: string;
  planId: PlanId;
  customer: { name: string; email: string; phone?: string };
}): Promise<{ sessionId: string; subscriptionId: string }> {
  const plan = PLANS.find((p) => p.id === args.planId && p.amount > 0);
  if (!plan) throw new Error("That plan can't be purchased online.");
  const planId = await ensurePlan(plan.id, plan.name, plan.amount);
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const subscriptionId = `gmi_${args.userId}_${Date.now()}`;
  const sub = await cfFetch<{
    subscription_id?: string;
    cf_subscription_id?: string | number;
    subscription_session_id?: string;
  }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      subscription_id: subscriptionId,
      customer_details: {
        customer_name: args.customer.name,
        customer_email: args.customer.email,
        // Cashfree requires a phone; fall back to its sandbox test number.
        customer_phone: args.customer.phone || "9999999999",
      },
      plan_details: { plan_id: planId },
      authorization_details: {
        authorization_amount: 1,
        authorization_amount_refund: true,
        payment_methods: ["upi", "card", "enach"],
      },
      subscription_meta: {
        return_url: `${siteUrl}/subscribe/callback`,
        notification_channel: ["EMAIL"],
      },
      subscription_expiry_time: "2100-01-01T00:00:00Z",
      subscription_tags: { site_plan: plan.id },
    }),
  });
  if (!sub.subscription_session_id) {
    throw new Error("Cashfree did not return a checkout session.");
  }
  await connect();
  await collections.users.updateOne(
    { _id: new ObjectId(args.userId) },
    {
      $set: {
        subscription: {
          id: subscriptionId,
          cfId: sub.cf_subscription_id ? String(sub.cf_subscription_id) : undefined,
          planId: plan.id,
          status: "created",
          updatedAt: new Date(),
        },
      },
    },
  );
  return { sessionId: sub.subscription_session_id, subscriptionId };
}

// Reads the live subscription status from Cashfree and applies it to the user
// that owns the subscription. Called by both the browser callback and webhook.
export async function reconcileSubscription(subscriptionId: string): Promise<ReconcileStatus> {
  await connect();
  const user = await collections.users.findOne({
    $or: [{ "subscription.id": subscriptionId }, { "subscription.cfId": subscriptionId }],
  });
  if (!user) return "failed";
  let status: string;
  try {
    const sub = await cfFetch<{ subscription_status?: string }>(
      `/subscriptions/${user.subscription?.id ?? subscriptionId}`,
      { method: "GET" },
    );
    status = String(sub.subscription_status ?? "").toUpperCase();
  } catch {
    return "pending";
  }
  const planId = user.subscription?.planId;
  const now = new Date();
  if (status === "ACTIVE") {
    const update: Record<string, unknown> = {
      "subscription.status": status,
      "subscription.updatedAt": now,
    };
    // Older subscription docs may predate planId — never write plan: undefined.
    if (planId) {
      update.plan = planId;
      update.planSince = now;
    }
    if (!isEditorial(user.role)) update.role = "subscriber";
    await collections.users.updateOne({ _id: user._id }, { $set: update });
    // Mail only on the transition — the webhook and the browser callback can
    // both land here, and a re-check shouldn't resend the welcome.
    const plan = PLANS.find((p) => p.id === planId);
    if (plan && user.plan !== planId) {
      try {
        await sendPlanConfirmEmail(user.email, user.name ?? user.email, plan);
      } catch {}
    }
    return "success";
  }
  if (status === "CANCELLED" || status === "COMPLETED" || status === "EXPIRED") {
    const update: Record<string, unknown> = {
      "subscription.status": status,
      "subscription.updatedAt": now,
    };
    if (user.plan === planId) {
      update.plan = "free";
      if (!isEditorial(user.role)) update.role = "reader";
    }
    await collections.users.updateOne({ _id: user._id }, { $set: update });
    return "cancelled";
  }
  await collections.users.updateOne(
    { _id: user._id },
    { $set: { "subscription.status": status || "PENDING", "subscription.updatedAt": now } },
  );
  // INITIALIZED / BANK_APPROVAL_PENDING: mandate started or awaiting the bank.
  return status === "INITIALIZED" || status === "BANK_APPROVAL_PENDING" ? "pending" : "failed";
}

// Cashfree can take a few seconds to flip a mandate INITIALIZED → ACTIVE after
// the reader authorises, and the browser redirect usually lands before that.
// Poll briefly so a valid payment doesn't strand on "pending" — the deeper
// safety net is the webhook, plus a re-check when /subscribe next loads.
export async function awaitReconcile(
  subscriptionId: string,
  tries = 4,
  delayMs = 1500,
): Promise<ReconcileStatus> {
  let status: ReconcileStatus = "pending";
  for (let attempt = 0; attempt < tries && status === "pending"; attempt += 1) {
    try {
      status = await reconcileSubscription(subscriptionId);
    } catch {
      status = "pending";
    }
    if (status === "pending" && attempt + 1 < tries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return status;
}

// Confirms the reader's own subscription after checkout returns. Only applies
// when the mandate belongs to this user, so a forged call can't upgrade others.
export async function confirmSubscription(
  userId: string,
  subscriptionId: string,
): Promise<ReconcileStatus> {
  await connect();
  const user = await collections.users.findOne({ _id: new ObjectId(userId) });
  if (!user) return "failed";
  const mine = user.subscription;
  if (mine?.id !== subscriptionId && mine?.cfId !== subscriptionId) return "failed";
  return awaitReconcile(mine?.id ?? subscriptionId);
}

// Cashfree signs webhooks as base64(HMAC-SHA256(secret, timestamp + rawBody))
// in the x-webhook-signature header, with x-webhook-timestamp alongside.
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET ?? process.env.CASHFREE_API_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
