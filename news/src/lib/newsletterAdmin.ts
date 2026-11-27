// Admin query layer for the newsletter delivery centre — stats, lists and
// management helpers for /admin/newsletters. All functions are read-only
// except the template mutations called by server actions.

import { ObjectId, type Filter, type Sort } from "mongodb";
import {
  collections,
  connect,
  type LetterDeliveryDoc,
  type LetterEditionDoc,
  type SchedulerStateDoc,
} from "./db";
import { editionIssueHtml, sendEditionEmail } from "./email";
import { getTemplates, pickEditionArticles } from "./deliveryEngine";
import { newsletterForTemplate, type LetterTemplate } from "./letterTemplates";
import { io } from "next/cache";

// ── Templates ──────────────────────────────────────────────────────────────

export async function upsertLetterTemplate(
  template: Omit<LetterTemplate, "createdAt" | "updatedAt">,
): Promise<{ ok: true } | { error: string }> {
  await connect();
  const exists = await collections.letterTemplates.findOne({ id: template.id });
  // New ids must not collide with a template under a different casing.
  if (!exists && (await collections.letterTemplates.findOne({ id: { $regex: `^${template.id}$`, $options: "i" } }))) {
    return { error: "A newsletter with a similar id already exists." };
  }
  await collections.letterTemplates.updateOne(
    { id: template.id },
    { $set: { ...template, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  return { ok: true };
}

export async function setTemplateActive(id: string, active: boolean) {
  await connect();
  const result = await collections.letterTemplates.updateOne(
    { id },
    { $set: { active, updatedAt: new Date() } },
  );
  return result.matchedCount ? { ok: true as const } : { error: "Unknown newsletter." };
}

// Subscriber counts per template — one aggregation, not N queries.
export async function subscriberCounts(): Promise<Record<string, number>> {
  await connect();
  await io();
  const rows = await collections.subscribers
    .aggregate<{ _id: string; count: number }>([
      { $unwind: "$letters" },
      { $group: { _id: "$letters", count: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

// The edition this template would produce right now — for preview/test send.
async function draftEdition(template: LetterTemplate) {
  const slugs = await pickEditionArticles(template);
  const label = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .toUpperCase();
  return { editionDate: label, articleSlugs: slugs };
}

export async function previewTemplate(
  id: string,
): Promise<{ ok: true; subject: string; html: string } | { error: string }> {
  const template = (await getTemplates()).find((item) => item.id === id);
  if (!template) return { error: "Unknown newsletter." };
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const edition = await draftEdition(template);
  const html = await editionIssueHtml(
    newsletterForTemplate(template),
    edition,
    "daily",
    `${siteUrl}/logo.png`,
    siteUrl,
    `${siteUrl}/newsletters`,
  );
  return { ok: true, subject: `${template.name} — ${edition.editionDate}`, html };
}

export async function sendTestEdition(
  id: string,
  email: string,
): Promise<{ ok: true; message: string } | { error: string }> {
  const template = (await getTemplates()).find((item) => item.id === id);
  if (!template) return { error: "Unknown newsletter." };
  const edition = await draftEdition(template);
  const result = await sendEditionEmail({
    to: email,
    letter: newsletterForTemplate(template),
    edition: { id: "test", editionDate: edition.editionDate, articleSlugs: edition.articleSlugs },
    format: "daily",
    deliveryId: `test-${id}`,
    letterId: template.id,
  });
  if (result.outcome === "sent") return { ok: true, message: `Test sent to ${email}.` };
  if (result.outcome === "skipped") return { error: result.detail ?? "Email provider not configured." };
  return { error: result.detail ?? "The provider rejected the test send." };
}

// ── Delivery centre queries ────────────────────────────────────────────────

export const DELIVERY_STATUSES = [
  "SCHEDULED",
  "QUEUED",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "MISSED",
  "DELAYED",
  "BOUNCED",
  "SKIPPED",
  "SUPPRESSED",
  "CANCELLED",
  "UNKNOWN",
] as const;

// Maps the delivery-centre filter params to a Mongo filter. Shared between
// the page query, CSV export and bulk-retry selection.
export function buildDeliveryFilter(input: {
  date?: string;
  from?: string;
  to?: string;
  templateId?: string;
  desk?: string;
  status?: string;
  subscriberType?: string;
  source?: string;
  q?: string;
}): Filter<LetterDeliveryDoc> {
  const filter: Filter<LetterDeliveryDoc> = {};
  const range: Record<string, Date> = {};
  const start = input.date ?? input.from;
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) range.$gte = new Date(`${start}T00:00:00.000Z`);
  const end = input.to;
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) range.$lt = new Date(`${end}T23:59:59.999Z`);
  if (start && !input.to && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    range.$lt = new Date(new Date(`${start}T00:00:00.000Z`).getTime() + 86_400_000);
  }
  if (Object.keys(range).length) filter.scheduledAt = range;
  if (input.templateId) filter.templateId = input.templateId;
  if (input.status && (DELIVERY_STATUSES as readonly string[]).includes(input.status)) {
    filter.status = input.status as LetterDeliveryDoc["status"];
  }
  if (input.source === "automatic" || input.source === "manual") filter.source = input.source;
  const q = String(input.q ?? "").trim();
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
    filter.$or = [{ email: { $regex: safe, $options: "i" } }, { name: { $regex: safe, $options: "i" } }];
  }
  return filter;
}

export type DeliveryListRow = {
  id: string;
  name?: string;
  email: string;
  templateId: string;
  letterName: string;
  editionId: string;
  editionDate: string;
  format: string;
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  status: string;
  attempts: number;
  failReason?: string;
  skipReason?: string;
  source: string;
};

export async function fetchDeliveryPage(input: {
  filter: Filter<LetterDeliveryDoc>;
  page: number;
  perPage?: number;
  sort?: string;
}): Promise<{ rows: DeliveryListRow[]; total: number; page: number; pages: number }> {
  await connect();
  await io();
  const perPage = Math.min(Math.max(input.perPage ?? 25, 5), 100);
  const sortMap: Record<string, Sort> = {
    scheduled_desc: { scheduledAt: -1 },
    scheduled_asc: { scheduledAt: 1 },
    email_asc: { email: 1 },
    attempts_desc: { attempts: -1 },
  };
  const sort = sortMap[input.sort ?? ""] ?? { scheduledAt: -1 };
  const [total, docs] = await Promise.all([
    collections.letterDeliveries.countDocuments(input.filter),
    collections.letterDeliveries
      .find(input.filter)
      .sort(sort)
      .skip((Math.max(1, input.page) - 1) * perPage)
      .limit(perPage)
      .toArray(),
  ]);
  const names = new Map((await getTemplates()).map((t) => [t.id, t.name]));
  const editionIds = docs.map((d) => d.editionId);
  const editions = await collections.letterEditions
    .find({ _id: { $in: editionIds } }, { projection: { editionDate: 1 } })
    .toArray();
  const dates = new Map(editions.map((e) => [String(e._id), e.editionDate]));
  const iso = (d?: Date) => (d ? d.toISOString() : undefined);
  return {
    total,
    page: input.page,
    pages: Math.max(1, Math.ceil(total / perPage)),
    rows: docs.map((d) => ({
      id: String(d._id),
      ...(d.name ? { name: d.name } : {}),
      email: d.email,
      templateId: d.templateId,
      letterName: names.get(d.templateId) ?? d.templateId,
      editionId: String(d.editionId),
      editionDate: dates.get(String(d.editionId)) ?? "",
      format: d.format,
      scheduledAt: d.scheduledAt.toISOString(),
      ...(d.sentAt ? { sentAt: iso(d.sentAt) } : {}),
      ...(d.deliveredAt ? { deliveredAt: iso(d.deliveredAt) } : {}),
      status: d.status,
      attempts: d.attempts,
      ...(d.failReason ? { failReason: d.failReason } : {}),
      ...(d.skipReason ? { skipReason: d.skipReason } : {}),
      source: d.source,
    })),
  };
}

export async function fetchDeliveryDetail(id: string) {
  if (!ObjectId.isValid(id)) return null;
  await connect();
  await io();
  const delivery = await collections.letterDeliveries.findOne({ _id: new ObjectId(id) });
  if (!delivery) return null;
  const [attempts, edition] = await Promise.all([
    collections.deliveryAttempts.find({ deliveryId: delivery._id }).sort({ at: -1 }).limit(50).toArray(),
    collections.letterEditions.findOne({ _id: delivery.editionId }),
  ]);
  const template = (await getTemplates()).find((t) => t.id === delivery.templateId);
  return { delivery, attempts, edition, letterName: template?.name ?? delivery.templateId };
}

// ── Overview stats ─────────────────────────────────────────────────────────

export type NewsletterOverview = {
  subscribers: { total: number; active: number; premium: number; suppressed: number };
  deliveries: Record<string, number>;
  successRate: number | null;
  perLetter: { id: string; name: string; sent: number; delivered: number; failed: number; bounced: number }[];
  daily: { date: string; sent: number; delivered: number; failed: number }[];
  recentFailures: { email: string; letter: string; reason?: string; at: string }[];
};

export async function fetchNewsletterOverview(days = 30): Promise<NewsletterOverview> {
  await connect();
  await io();
  const since = new Date(Date.now() - days * 86_400_000);
  const [subAgg, delAgg, perLetter, daily, failures, suppressedCount, premiumCount] = await Promise.all([
    collections.subscribers
      .aggregate<{ _id: null; total: number; withLetters: number }>([
        { $group: { _id: null, total: { $sum: 1 }, withLetters: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$letters", []] } }, 0] }, 1, 0] } } } },
      ])
      .toArray(),
    collections.letterDeliveries
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
    collections.letterDeliveries
      .aggregate<{ _id: string; sent: number; delivered: number; failed: number; bounced: number }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$templateId",
            sent: { $sum: { $cond: [{ $in: ["$status", ["SENT", "DELIVERED", "DELAYED"]] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $eq: ["$status", "BOUNCED"] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
    collections.letterDeliveries
      .aggregate<{ _id: string; sent: number; delivered: number; failed: number }>([
        { $match: { sentAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } },
            sent: { $sum: { $cond: [{ $in: ["$status", ["SENT", "DELIVERED"]] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $in: ["$status", ["FAILED", "BOUNCED"]] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    collections.letterDeliveries
      .find({ status: { $in: ["FAILED", "BOUNCED"] } }, { projection: { email: 1, templateId: 1, failReason: 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray(),
    collections.suppressions.countDocuments({}),
    collections.users.countDocuments({ plan: { $in: ["premium", "premium-plus"] } }),
  ]);

  const deliveries = Object.fromEntries(delAgg.map((row) => [row._id, row.count]));
  const accepted = (deliveries.SENT ?? 0) + (deliveries.DELIVERED ?? 0) + (deliveries.DELAYED ?? 0);
  const terminal = accepted + (deliveries.FAILED ?? 0) + (deliveries.BOUNCED ?? 0);
  const names = new Map((await getTemplates()).map((t) => [t.id, t.name]));
  return {
    subscribers: {
      total: subAgg[0]?.total ?? 0,
      active: subAgg[0]?.withLetters ?? 0,
      premium: premiumCount,
      suppressed: suppressedCount,
    },
    deliveries,
    successRate: terminal ? Math.round((accepted / terminal) * 100) : null,
    perLetter: perLetter.map((row) => ({
      id: row._id,
      name: names.get(row._id) ?? row._id,
      sent: row.sent,
      delivered: row.delivered,
      failed: row.failed,
      bounced: row.bounced,
    })),
    daily: daily.map((row) => ({ date: row._id, sent: row.sent, delivered: row.delivered, failed: row.failed })),
    recentFailures: failures.map((d) => ({
      email: d.email,
      letter: names.get(d.templateId) ?? d.templateId,
      ...(d.failReason ? { reason: d.failReason } : {}),
      at: d.updatedAt.toISOString(),
    })),
  };
}

// ── Editions / scheduler / events ──────────────────────────────────────────

export async function fetchEditionsPage(input: {
  page: number;
  templateId?: string;
  perPage?: number;
}): Promise<{ rows: LetterEditionDoc[]; total: number; pages: number }> {
  await connect();
  await io();
  const perPage = Math.min(Math.max(input.perPage ?? 20, 5), 100);
  const filter: Filter<LetterEditionDoc> = input.templateId ? { templateId: input.templateId } : {};
  const [total, rows] = await Promise.all([
    collections.letterEditions.countDocuments(filter),
    collections.letterEditions
      .find(filter)
      .sort({ scheduledAt: -1 })
      .skip((Math.max(1, input.page) - 1) * perPage)
      .limit(perPage)
      .toArray(),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function fetchSchedulerStatus() {
  await connect();
  await io();
  const [state, queue, runs, webhook] = await Promise.all([
    collections.schedulerState.findOne({ _id: "scheduler" }) as Promise<SchedulerStateDoc | null>,
    collections.letterDeliveries
      .aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray(),
    collections.schedulerRuns.find({}).sort({ startedAt: -1 }).limit(25).toArray(),
    collections.webhookEvents.findOne({}, { sort: { receivedAt: -1 }, projection: { receivedAt: 1 } }),
  ]);
  const overdue = await collections.letterDeliveries.countDocuments({
    status: { $in: ["SCHEDULED", "QUEUED"] },
    scheduledAt: { $lt: new Date() },
  });
  const heartbeatAge = state?.heartbeatAt ? Date.now() - state.heartbeatAt.getTime() : null;
  return {
    state,
    queue: Object.fromEntries(queue.map((row) => [row._id, row.count])),
    overdue,
    runs,
    lastWebhookAt: webhook?.receivedAt?.toISOString() ?? null,
    // A heartbeat fresher than 3 minutes means a worker is alive somewhere.
    alive: heartbeatAge !== null && heartbeatAge < 3 * 60_000,
  };
}

// CSV export of the filtered delivery rows — same filter as the table.
export async function deliveriesCsv(filter: Filter<LetterDeliveryDoc>): Promise<string> {
  await connect();
  const docs = await collections.letterDeliveries.find(filter).sort({ scheduledAt: -1 }).limit(5000).toArray();
  const names = new Map((await getTemplates()).map((t) => [t.id, t.name]));
  const esc = (value: unknown) => {
    const s = String(value ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "email,name,newsletter,edition,format,status,scheduled_at,sent_at,delivered_at,attempts,source,fail_reason\n";
  const lines = docs.map((d) =>
    [
      d.email,
      d.name ?? "",
      names.get(d.templateId) ?? d.templateId,
      String(d.editionId),
      d.format,
      d.status,
      d.scheduledAt.toISOString(),
      d.sentAt?.toISOString() ?? "",
      d.deliveredAt?.toISOString() ?? "",
      d.attempts,
      d.source,
      d.failReason ?? d.skipReason ?? "",
    ]
      .map(esc)
      .join(","),
  );
  return header + lines.join("\n");
}
