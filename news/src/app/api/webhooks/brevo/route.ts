import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { collections, connect, type DeliveryStatus } from "@/lib/db";

// Brevo transactional webhook. Brevo can't sign payloads, so the endpoint is
// authenticated by a token in the webhook URL instead:
//   https://<host>/api/webhooks/brevo?token=$BREVO_WEBHOOK_SECRET
// Configure under Brevo → Transactional → Webhooks with the events you want.
// Events are persisted before acknowledgement and deduped by
// (messageId + event + ts_event), so retries and reordering are safe.

const EVENT_STATUS: Record<string, DeliveryStatus | null> = {
  request: "SENT",
  sent: "SENT",
  delivered: "DELIVERED",
  deferred: "DELAYED",
  soft_bounce: "DELAYED",
  hard_bounce: "BOUNCED",
  blocked: "BOUNCED",
  invalid_email: "BOUNCED",
  spam: "SUPPRESSED",
  complaint: "SUPPRESSED",
  unsubscribed: "SUPPRESSED",
  error: "FAILED",
  // informational only — recorded, not applied to delivery status
  opened: null,
  click: null,
  unique_opened: null,
  loaded_by_proxy: null,
};

// Events that add the address to the suppression list immediately.
const SUPPRESS_REASON: Record<string, "bounce" | "complaint" | "unsubscribe" | "blocked" | "invalid"> = {
  hard_bounce: "bounce",
  blocked: "blocked",
  invalid_email: "invalid",
  spam: "complaint",
  complaint: "complaint",
  unsubscribed: "unsubscribe",
};

// Statuses a late event must not downgrade.
const TERMINAL: DeliveryStatus[] = ["DELIVERED", "BOUNCED", "SUPPRESSED", "CANCELLED"];

async function applyEvent(doc: Record<string, unknown>): Promise<{ deliveryId?: ObjectId; result: string }> {
  const event = String(doc.event ?? "");
  const email = String(doc.email ?? "").trim().toLowerCase();
  const messageId = String(doc["message-id"] ?? doc.id ?? "");
  const tags = Array.isArray(doc.tags) ? doc.tags.map(String) : [];
  const tsEvent = typeof doc.ts_event === "number" ? doc.ts_event : undefined;

  const deliveryTag = tags.find((tag) => tag.startsWith("delivery:"));
  const deliveryIdRaw = deliveryTag?.slice(9) ?? "";
  const delivery = deliveryTag && ObjectId.isValid(deliveryIdRaw)
    ? await collections.letterDeliveries.findOne({ _id: new ObjectId(deliveryIdRaw) })
    : messageId
      ? await collections.letterDeliveries.findOne({ providerMessageId: messageId, ...(email ? { email } : {}) })
      : email
        ? await collections.letterDeliveries.findOne({ email }, { sort: { scheduledAt: -1 } })
        : null;

  const target = EVENT_STATUS[event];
  const suppress = SUPPRESS_REASON[event];

  if (suppress && email) {
    await collections.suppressions.updateOne(
      { email },
      { $setOnInsert: { email, reason: suppress, detail: `Brevo event "${event}"`, createdAt: new Date() } },
      { upsert: true },
    );
    // A provider-driven opt-out also cancels the pending queue for this address.
    await collections.letterDeliveries.updateMany(
      { email, status: { $in: ["SCHEDULED", "QUEUED", "DELAYED"] } },
      { $set: { status: "SUPPRESSED", skipReason: `Provider reported ${event}.`, updatedAt: new Date() } },
    );
    if (event === "unsubscribed") {
      const letterTag = tags.find((tag) => tag.startsWith("letter:"));
      if (letterTag) {
        await collections.subscribers.updateOne({ email }, { $pull: { letters: letterTag.slice(7) } });
      }
    }
  }

  if (!delivery) return { result: "no matching delivery" };

  const now = new Date();
  const sets: Record<string, unknown> = { updatedAt: now };
  if (messageId && !delivery.providerMessageId) sets.providerMessageId = messageId;
  if (event === "opened" || event === "unique_opened") sets.lastOpenedAt = now;
  if (event === "click") sets.lastClickedAt = now;

  if (target && !TERMINAL.includes(delivery.status)) {
    sets.status = target;
    if (target === "DELIVERED") sets.deliveredAt = tsEvent ? new Date(tsEvent * 1000) : now;
    if (target === "BOUNCED" || target === "FAILED") sets.failReason = `Provider reported ${event}.`;
    if (target === "SUPPRESSED") sets.skipReason = `Provider reported ${event}.`;
    if (target === "DELAYED") sets.providerCode = event;
  }
  // A terminal row can still record a later complaint: DELIVERED → SUPPRESSED.
  if (delivery.status === "DELIVERED" && target === "SUPPRESSED") {
    sets.status = "SUPPRESSED";
    sets.skipReason = `Provider reported ${event} after delivery.`;
  }

  await collections.letterDeliveries.updateOne({ _id: delivery._id }, { $set: sets });
  await collections.deliveryAttempts
    .insertOne({
      deliveryId: delivery._id,
      at: now,
      by: "webhook",
      outcome: "event",
      detail: `Brevo ${event}${target ? ` → ${target}` : ""}`,
      providerMessageId: messageId || undefined,
    } as never)
    .catch(() => {});
  return { deliveryId: delivery._id, result: `${event}${target ? ` → ${target}` : " recorded"}` };
}

export async function POST(request: Request) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  const token = new URL(request.url).searchParams.get("token");
  if (secret && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  await connect();

  // Brevo posts one event per request; accept a batch too, harmlessly.
  const events = Array.isArray(payload) ? payload : [payload];
  const results: string[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const doc = raw as Record<string, unknown>;
    const eventId = `${doc["message-id"] ?? doc.id ?? ""}|${doc.event ?? ""}|${doc.ts_event ?? ""}`;
    try {
      await collections.webhookEvents.insertOne({
        provider: "brevo",
        eventId,
        event: String(doc.event ?? "unknown"),
        messageId: String(doc["message-id"] ?? ""),
        email: String(doc.email ?? "").toLowerCase(),
        tsEvent: typeof doc.ts_event === "number" ? doc.ts_event : undefined,
        payload: doc,
        receivedAt: new Date(),
      } as never);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        results.push(`${eventId}: duplicate`);
        continue; // seen before — acknowledge without reprocessing
      }
      throw error;
    }
    const { deliveryId, result } = await applyEvent(doc);
    await collections.webhookEvents.updateOne(
      { eventId },
      { $set: { processedAt: new Date(), ...(deliveryId ? { deliveryId } : {}), result } },
    );
    results.push(`${eventId}: ${result}`);
  }
  return NextResponse.json({ ok: true, results });
}
