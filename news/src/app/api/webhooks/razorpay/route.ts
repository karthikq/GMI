import { NextResponse } from "next/server";
import { reconcileSubscription, verifyWebhookSignature } from "@/lib/razorpay";

// Razorpay posts subscription lifecycle events here (subscription.authenticated,
// subscription.activated, subscription.cancelled, …). The payload is only a
// trigger — the real status is re-fetched inside reconcileSubscription().
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const subPayload = (payload?.payload ?? {}) as Record<string, unknown>;
  const entity = (subPayload.subscription ?? {}) as Record<string, unknown>;
  const sid = (entity.entity ?? entity) as Record<string, unknown>;
  const subscriptionId = sid.id ?? entity.id;
  if (typeof subscriptionId === "string" && subscriptionId) {
    try {
      await reconcileSubscription(subscriptionId);
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
