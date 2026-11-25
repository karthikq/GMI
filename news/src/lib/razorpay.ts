import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, connect } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/plans";
import { isEditorial } from "@/lib/roles";

// Razorpay Subscriptions (autopay via UPI, card and eNACH mandates). Docs:
// https://razorpay.com/docs/api/subscriptions/
export type ReconcileStatus = "success" | "pending" | "failed" | "cancelled";

export function razorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) {
    throw new Error("Payments aren't configured yet — Razorpay keys are missing.");
  }
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

async function rpFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: authHeader(),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { description?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.description ?? `Razorpay request failed (${res.status}).`);
  }
  return data as T;
}

// Each site plan maps to a Razorpay plan that is created once and cached in the
// settings collection, so keys are the only setup needed.
async function planIdFor(planId: PlanId, name: string, amount: number): Promise<string> {
  await connect();
  const key = `razorpayPlan:${planId}`;
  const cached = await collections.settings.findOne({ _id: key });
  if (cached?.value) return cached.value;
  const plan = await rpFetch<{ id?: string }>("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: { name, amount: amount * 100, currency: "INR" },
      notes: { site_plan: planId },
    }),
  });
  if (!plan.id) throw new Error("Razorpay did not return a plan id.");
  await collections.settings.updateOne({ _id: key }, { $set: { value: plan.id } }, { upsert: true });
  return plan.id;
}

// Creates a Razorpay subscription and records it on the user so the callback
// and the webhook can match the mandate back to this account.
export async function createRazorpaySubscription(args: {
  userId: string;
  planId: PlanId;
}): Promise<{ subscriptionId: string }> {
  const plan = PLANS.find((p) => p.id === args.planId && p.amount > 0);
  if (!plan) throw new Error("That plan can't be purchased online.");
  const planId = await planIdFor(plan.id, `GMI ${plan.name}`, plan.amount);
  const sub = await rpFetch<{ id?: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      // total_count counts debits; 99 years is effectively "until cancelled".
      total_count: 1200,
      customer_notify: 1,
      notes: { site_plan: plan.id, user: args.userId },
    }),
  });
  if (!sub.id) throw new Error("Razorpay did not return a subscription id.");
  await connect();
  await collections.users.updateOne(
    { _id: new ObjectId(args.userId) },
    {
      $set: {
        subscription: {
          id: sub.id,
          planId: plan.id,
          status: "created",
          updatedAt: new Date(),
        },
      },
    },
  );
  return { subscriptionId: sub.id };
}

async function getRazorpaySubscription(subscriptionId: string) {
  return rpFetch<{ status?: string }>(`/subscriptions/${subscriptionId}`, { method: "GET" });
}

// Reads the live mandate status from Razorpay and applies it to the user that
// owns the subscription. Called by both the browser callback and the webhook.
export async function reconcileSubscription(subscriptionId: string): Promise<ReconcileStatus> {
  await connect();
  const user = await collections.users.findOne({ "subscription.id": subscriptionId });
  if (!user) return "failed";
  let status: string;
  try {
    const sub = await getRazorpaySubscription(subscriptionId);
    status = String(sub.status ?? "").toLowerCase();
  } catch {
    return "pending";
  }
  const planId = user.subscription?.planId;
  const now = new Date();
  // "authenticated" = mandate approved, first debit scheduled; "active" = live.
  if (status === "active" || status === "authenticated") {
    const update: Record<string, unknown> = {
      plan: planId,
      planSince: now,
      "subscription.status": status,
      "subscription.updatedAt": now,
    };
    if (!isEditorial(user.role)) update.role = "subscriber";
    await collections.users.updateOne({ _id: user._id }, { $set: update });
    return "success";
  }
  if (status === "cancelled" || status === "completed" || status === "expired" || status === "halted") {
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
    { $set: { "subscription.status": status || "pending", "subscription.updatedAt": now } },
  );
  return status === "created" || status === "pending" ? "pending" : "failed";
}

// Confirms the reader's own subscription after checkout returns. Only applies
// when the mandate belongs to this user, so a forged call can't upgrade others.
export async function confirmSubscription(
  userId: string,
  subscriptionId: string,
): Promise<ReconcileStatus> {
  await connect();
  const user = await collections.users.findOne({ _id: new ObjectId(userId) });
  if (!user || user.subscription?.id !== subscriptionId) return "failed";
  return reconcileSubscription(subscriptionId);
}

// Razorpay signs webhooks as hex(HMAC-SHA256(webhook_secret, rawBody)).
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
