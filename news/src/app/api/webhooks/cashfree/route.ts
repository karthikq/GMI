import { NextResponse } from "next/server";
import { reconcileSubscription, verifyWebhookSignature } from "@/lib/cashfree";

// Cashfree posts subscription lifecycle events here (SUBSCRIPTION_ACTIVATED,
// SUBSCRIPTION_CANCELED, …). The payload is only a trigger — the real status
// is re-fetched inside reconcileSubscription().
export async function POST(request: Request) {
  const raw = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp");
  const signature = request.headers.get("x-webhook-signature");
  if (!verifyWebhookSignature(raw, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const data = (payload?.data ?? {}) as Record<string, unknown>;
  const subscription = (data.subscription ?? {}) as Record<string, unknown>;
  const subscriptionId =
    subscription.subscription_id ?? subscription.cf_subscription_id ?? data.subscription_id;
  if (typeof subscriptionId === "string" && subscriptionId) {
    try {
      await reconcileSubscription(subscriptionId);
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
