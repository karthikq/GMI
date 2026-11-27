// The durable newsletter delivery engine. A trigger (Hostinger cron,
// cron-job.org, Vercel cron, or the admin Run-now button) calls
// runSchedulerTick() as often as every minute. All state lives in Mongo, so
// the trigger only controls latency — never correctness:
//
//   letterTemplates   what to send, when, to whom (seeded from code, admin-edited)
//   letterEditions    one frozen issue per template per period
//   letterDeliveries  one row per recipient per edition — the work queue
//   deliveryAttempts  append-only history of everything done to a delivery
//   schedulerState    singleton heartbeat / last-good-run
//   schedulerRuns     one log row per tick
//
// Atomic claims (status lease) make overlapping triggers and multiple
// workers safe; the unique (editionId, email) index makes retries and
// duplicate ticks idempotent.

import { randomBytes } from "node:crypto";
import { ObjectId, type Filter } from "mongodb";
import {
  collections,
  connect,
  type DeliveryAttemptDoc,
  type LetterDeliveryDoc,
  type LetterEditionDoc,
} from "./db";
import { sendEditionEmail } from "./email";
import { newsletterForTemplate, seedTemplates, type LetterTemplate } from "./letterTemplates";
import { dueSlots, recipientSendAt, GLOBAL_SEND_TIME, type Schedule } from "./scheduler";

export const DEFAULT_TZ = "Asia/Kolkata";
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

const CATCH_UP_HOURS = Number(process.env.DELIVERY_CATCH_UP_HOURS) || 24;
const WORKER_BATCH = Number(process.env.DELIVERY_BATCH_SIZE) || 20;
const MAX_ATTEMPTS = Number(process.env.DELIVERY_MAX_ATTEMPTS) || 5;
const LEASE_MS = Number(process.env.DELIVERY_LEASE_MS) || 120_000;
const TICK_LOCK_MS = 90_000; // a hung tick's lock expires so the next run proceeds

const workerId = process.env.HOSTNAME || `worker-${randomBytes(3).toString("hex")}`;

// ── Templates ──────────────────────────────────────────────────────────────

// DB templates are authoritative after seeding; the code catalogue fills any
// gap (fresh dev DB before connect() seeds, or a template deleted by hand).
export async function getTemplates(onlyActive = false): Promise<LetterTemplate[]> {
  await connect();
  const docs = await collections.letterTemplates.find({}).toArray();
  const byId = new Map(docs.map((doc) => [doc.id, doc as unknown as LetterTemplate]));
  const seeded = seedTemplates();
  const merged = new Map(seeded.map((template) => [template.id, template]));
  for (const doc of docs) merged.set(doc.id, doc as unknown as LetterTemplate);
  const out = [...merged.values()];
  // Drop code-catalogue ids the DB says are inactive, keep admin-created ones.
  return out
    .map((template) => byId.get(template.id) ?? template)
    .filter((template) => (onlyActive ? template.active : true));
}

export async function getTemplate(id: string): Promise<LetterTemplate | null> {
  const all = await getTemplates();
  return all.find((template) => template.id === id) ?? null;
}

// ── Editions ───────────────────────────────────────────────────────────────

const DAY_LONG = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function editionDateLabel(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_LONG[date.getUTCDay()].slice(0, 3)}, ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

// Freeze the edition's article picks once: the newest published stories on
// the template's desks. Stored slugs make retries deterministic. Exported
// for admin previews and test sends.
export async function pickEditionArticles(template: LetterTemplate): Promise<string[]> {
  const filter = { publishedAt: { $lte: new Date() } };
  const projection = { slug: 1, section: 1 };
  const docs = await collections.articles
    .find<{ slug: string; section?: string }>(filter, { projection })
    .sort({ publishedAt: -1 })
    .limit(300)
    .toArray();
  const sectionByName = new Map(
    (await import("./data")).sections.map((section) => [section.name.toLowerCase(), section.slug]),
  );
  const wanted = new Set(
    (template.deskSlug ? [template.deskSlug] : template.topics.map((t) => sectionByName.get(t.toLowerCase())))
      .filter((slug): slug is string => Boolean(slug)),
  );
  const scoped = docs.filter((doc) => wanted.has(doc.section ?? ""));
  const rest = docs.filter((doc) => !wanted.has(doc.section ?? ""));
  // Desks first; general pool fills the remainder so a quiet desk still mails.
  return [...scoped, ...rest].slice(0, template.articleCount).map((doc) => doc.slug);
}

async function generateEdition(
  template: LetterTemplate,
  slot: { localDate: string; periodKey: string; scheduledAt: Date; missed: boolean },
  now: Date,
): Promise<LetterEditionDoc | null> {
  const existing = await collections.letterEditions.findOne({
    templateId: template.id,
    periodKey: slot.periodKey,
  });
  if (existing) return existing as LetterEditionDoc;

  const slugs = await pickEditionArticles(template);
  const editionDate = editionDateLabel(slot.localDate);
  const templateDoc = { ...template };
  let status: LetterEditionDoc["status"] = "ready";
  let skipReason: string | undefined;
  if (slugs.length < template.minArticles) {
    if (templateDoc.onEmpty === "send-with-fallback") {
      status = "ready"; // the letter's canned sample fills in — never fabricated
    } else {
      status = template.onEmpty === "hold" ? "hold" : "skipped";
      skipReason = `Only ${slugs.length} published stories (minimum ${template.minArticles}).`;
    }
  }

  const doc = {
    templateId: template.id,
    periodKey: slot.periodKey,
    editionDate,
    subject: `${template.name} — ${editionDate}`,
    articleSlugs: slugs,
    articleCount: slugs.length,
    schedule: template.schedule,
    scheduledAt: slot.scheduledAt,
    status,
    ...(skipReason ? { skipReason } : {}),
    createdAt: now,
  };
  try {
    const result = await collections.letterEditions.insertOne(doc);
    return { ...doc, _id: result.insertedId } as LetterEditionDoc;
  } catch (error) {
    // Another worker generated it first — take theirs.
    if ((error as { code?: number }).code === 11000) {
      return (await collections.letterEditions.findOne({
        templateId: template.id,
        periodKey: slot.periodKey,
      })) as LetterEditionDoc | null;
    }
    throw error;
  }
}

// ── Recipient planning ────────────────────────────────────────────────────

type SubscriberRow = {
  _id: ObjectId;
  email: string;
  letters?: string[];
  sendTime?: string;
  letterFormats?: Record<string, string>;
  timeZone?: string;
};

async function premiumEmails(emails: string[]): Promise<Set<string>> {
  if (!emails.length) return new Set();
  const users = await collections.users
    .find({ email: { $in: emails } }, { projection: { email: 1, plan: 1, "subscription.status": 1 } })
    .toArray();
  const ok = new Set<string>();
  for (const user of users) {
    const plan = String(user.plan ?? "");
    const subStatus = String(user.subscription?.status ?? "").toUpperCase();
    const active = !subStatus || subStatus === "ACTIVE" || subStatus === "COMPLETED";
    if ((plan === "premium" || plan === "premium-plus") && active) ok.add(String(user.email));
  }
  return ok;
}

// Upsert a delivery row per subscribed recipient for one edition. Idempotent
// via the unique (editionId, email) index — reruns just skip existing rows.
async function planEditionDeliveries(
  template: LetterTemplate,
  edition: LetterEditionDoc,
  slot: { localDate: string; missed: boolean },
  now: Date,
): Promise<{ planned: number; missed: number }> {
  const subs = (await collections.subscribers
    .find({ letters: template.id })
    .toArray()) as unknown as SubscriberRow[];
  if (!subs.length) return { planned: 0, missed: 0 };

  const suppressed = new Set(
    (
      await collections.suppressions
        .find({ email: { $in: subs.map((sub) => sub.email) } }, { projection: { email: 1 } })
        .toArray()
    ).map((doc) => doc.email),
  );
  const premiumOk = template.premium ? await premiumEmails(subs.map((sub) => sub.email)) : null;
  const names = new Map(
    (
      await collections.users
        .find({ email: { $in: subs.map((s) => s.email) } }, { projection: { email: 1, name: 1 } })
        .toArray()
    ).map((user) => [String(user.email), String(user.name ?? "")]),
  );

  let planned = 0;
  let missed = 0;
  const writes = subs.map((sub) => {
    const suppressedHit = suppressed.has(sub.email);
    const premiumBlocked = premiumOk !== null && !premiumOk.has(sub.email);
    // One global send time for every letter — the reader's own pick or the
    // 7:30 AM default; the day still comes from the template's schedule.
    const sendAt = recipientSendAt(
      { time: template.schedule.time, timeZone: template.schedule.timeZone },
      { time: sub.sendTime ?? GLOBAL_SEND_TIME, timeZone: sub.timeZone },
      slot.localDate,
    );
    const status = suppressedHit
      ? "SUPPRESSED"
      : premiumBlocked
        ? "SUPPRESSED"
        : edition.status !== "ready"
          ? "SKIPPED"
          : slot.missed || sendAt.getTime() + CATCH_UP_HOURS * HOUR_MS < now.getTime()
            ? "MISSED"
            : sendAt <= now
              ? "QUEUED"
              : "SCHEDULED";
    const reason = suppressedHit
      ? "Address is on the suppression list."
      : premiumBlocked
        ? "Premium plan no longer active."
        : edition.status !== "ready"
          ? edition.skipReason ?? "Edition has no content."
          : status === "MISSED"
            ? "Send window expired before the scheduler ran."
            : undefined;
    if (status === "MISSED") missed += 1;
    else if (status === "QUEUED" || status === "SCHEDULED") planned += 1;
    return collections.letterDeliveries.updateOne(
      { editionId: edition._id, email: sub.email },
      {
        $setOnInsert: {
          templateId: template.id,
          editionId: edition._id,
          subscriberId: sub._id,
          email: sub.email,
          name: names.get(sub.email) || undefined,
          format: sub.letterFormats?.[template.id] ?? "daily",
          scheduledAt: sendAt,
          status,
          attempts: 0,
          source: "automatic",
          ...(reason ? { skipReason: reason } : {}),
          createdAt: now,
          updatedAt: now,
        } as Partial<LetterDeliveryDoc>,
      },
      { upsert: true },
    );
  });
  await Promise.all(writes);
  return { planned, missed };
}

// ── The tick ───────────────────────────────────────────────────────────────

export type TickResult = {
  runId: string;
  plannedEditions: number;
  queued: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  missedMarked: number;
  reaped: number;
  promoted: number;
  errors: string[];
};

async function attempt(
  deliveryId: ObjectId,
  outcome: DeliveryAttemptDoc["outcome"],
  fields: Omit<DeliveryAttemptDoc, "_id" | "deliveryId" | "at" | "outcome">,
) {
  const doc = { deliveryId, at: new Date(), outcome, ...fields } as DeliveryAttemptDoc;
  await collections.deliveryAttempts.insertOne(doc).catch(() => {});
}

function backoffMs(attempts: number, retryAfterSec?: number): number {
  if (retryAfterSec) return Math.min(retryAfterSec * 1000, HOUR_MS);
  return Math.min(MIN_MS * Math.pow(2, Math.min(attempts, 8)), HOUR_MS);
}

// Revalidate right before sending — the spec is explicit that subscription,
// suppression and premium are checked at send time, not plan time.
async function recipientEligible(
  template: LetterTemplate,
  delivery: LetterDeliveryDoc,
): Promise<{ ok: true } | { ok: false; status: "SUPPRESSED" | "SKIPPED"; reason: string }> {
  const [suppression, sub] = await Promise.all([
    collections.suppressions.findOne({ email: delivery.email }),
    collections.subscribers.findOne({ email: delivery.email }),
  ]);
  if (suppression) {
    return { ok: false, status: "SUPPRESSED", reason: `Suppressed: ${suppression.reason}` };
  }
  if (!sub || !Array.isArray(sub.letters) || !sub.letters.includes(template.id)) {
    return { ok: false, status: "SKIPPED", reason: "Recipient unsubscribed since planning." };
  }
  if (template.premium && !(await premiumEmails([delivery.email])).has(delivery.email)) {
    return { ok: false, status: "SUPPRESSED", reason: "Premium plan no longer active." };
  }
  return { ok: true };
}

async function sendDelivery(delivery: LetterDeliveryDoc, template: LetterTemplate): Promise<"sent" | "failed" | "skipped"> {
  const now = new Date();
  const eligibility = await recipientEligible(template, delivery);
  if (!eligibility.ok) {
    await collections.letterDeliveries.updateOne(
      { _id: delivery._id },
      {
        $set: { status: eligibility.status, skipReason: eligibility.reason, updatedAt: now },
        $unset: { leaseOwner: "", leaseExpiresAt: "" },
      },
    );
    await attempt(delivery._id, "skipped", { detail: eligibility.reason, by: "scheduler" });
    return "skipped";
  }

  const edition = await collections.letterEditions.findOne({ _id: delivery.editionId });
  if (!edition || edition.status !== "ready") {
    const reason = edition?.skipReason ?? "Edition unavailable.";
    await collections.letterDeliveries.updateOne(
      { _id: delivery._id },
      {
        $set: { status: "SKIPPED", skipReason: reason, updatedAt: now },
        $unset: { leaseOwner: "", leaseExpiresAt: "" },
      },
    );
    await attempt(delivery._id, "skipped", { detail: reason, by: "scheduler" });
    return "skipped";
  }

  const letter = newsletterForTemplate(template);
  const result = await sendEditionEmail({
    to: delivery.email,
    name: delivery.name,
    letter,
    edition: {
      id: String(edition._id),
      editionDate: edition.editionDate,
      articleSlugs: edition.articleSlugs,
    },
    format: delivery.format,
    deliveryId: String(delivery._id),
    letterId: template.id,
  });

  const base = { updatedAt: new Date(), lastAttemptAt: now };
  if (result.outcome === "sent") {
    await collections.letterDeliveries.updateOne(
      { _id: delivery._id },
      {
        $set: {
          ...base,
          status: "SENT",
          sentAt: now,
          ...(result.messageId ? { providerMessageId: result.messageId } : {}),
        },
        $inc: { attempts: 1 },
        $unset: { leaseOwner: "", leaseExpiresAt: "", nextRetryAt: "", failReason: "" },
      },
    );
    await attempt(delivery._id, "sent", {
      by: "scheduler",
      providerMessageId: result.messageId,
      detail: "Accepted by provider.",
    });
    return "sent";
  }
  if (result.outcome === "ambiguous") {
    // Timeout/network failure after the request may have been accepted — do
    // NOT resend blind. Mark UNKNOWN; reconciliation or the admin decides.
    await collections.letterDeliveries.updateOne(
      { _id: delivery._id },
      {
        $set: { ...base, status: "UNKNOWN", providerCode: "timeout", failReason: result.detail },
        $inc: { attempts: 1 },
        $unset: { leaseOwner: "", leaseExpiresAt: "" },
      },
    );
    await attempt(delivery._id, "failed", { by: "scheduler", detail: `Ambiguous: ${result.detail}` });
    return "failed";
  }

  const attempts = delivery.attempts + 1;
  const exhausted = !result.retryable || attempts >= MAX_ATTEMPTS;
  const nextRetryAt = exhausted ? undefined : new Date(now.getTime() + backoffMs(attempts, result.retryAfterSec));
  await collections.letterDeliveries.updateOne(
    { _id: delivery._id },
    {
      $set: {
        ...base,
        status: exhausted ? "FAILED" : "QUEUED",
        failReason: result.detail,
        ...(result.providerCode ? { providerCode: result.providerCode } : {}),
        ...(nextRetryAt ? { nextRetryAt } : {}),
      },
      $inc: { attempts: 1 },
      $unset: {
        leaseOwner: "",
        leaseExpiresAt: "",
        ...(nextRetryAt ? {} : { nextRetryAt: "" }),
      } as never,
    },
  );
  await attempt(delivery._id, exhausted ? "failed" : "retry-scheduled", {
    by: "scheduler",
    detail: result.detail,
    providerStatus: result.providerStatus,
  });
  return exhausted ? "failed" : "skipped";
}

// Atomically claim due deliveries one at a time — a lease (owner + expiry)
// instead of a lock so a crashed worker's jobs are taken over, not lost.
async function claimOne(now: Date): Promise<LetterDeliveryDoc | null> {
  return (await collections.letterDeliveries.findOneAndUpdate(
    {
      status: "QUEUED",
      scheduledAt: { $lte: now },
      $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: { $lte: now } }],
    },
    {
      $set: {
        status: "PROCESSING",
        leaseOwner: workerId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        updatedAt: now,
      },
    },
    { sort: { scheduledAt: 1 }, returnDocument: "after" },
  )) as LetterDeliveryDoc | null;
}

export async function runSchedulerTick(trigger: "cron" | "manual" | "reconcile"): Promise<TickResult | { error: string }> {
  await connect();
  const now = new Date();

  // Tick-level mutual exclusion so overlapping triggers don't double-plan.
  // A matching-but-locked doc makes the upsert try to insert _id "scheduler"
  // and fail E11000 — that is the busy signal, not an error.
  let lock: unknown = null;
  try {
    lock = await collections.schedulerState.findOneAndUpdate(
      {
        _id: "scheduler",
        $or: [
          { runningUntil: { $exists: false } },
          { runningUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          heartbeatAt: now,
          runningUntil: new Date(now.getTime() + TICK_LOCK_MS),
          runningBy: workerId,
          timeZone: DEFAULT_TZ,
          lastRunStartedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) lock = null;
    else throw error;
  }
  if (!lock) return { error: "Another scheduler tick is already running." };

  const run = await collections.schedulerRuns.insertOne({
    trigger,
    workerId,
    startedAt: now,
    plannedEditions: 0,
    queued: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    missedMarked: 0,
    errors: [],
  });
  const result: TickResult = {
    runId: String(run.insertedId),
    plannedEditions: 0,
    queued: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    missedMarked: 0,
    reaped: 0,
    promoted: 0,
    errors: [],
  };

  try {
    // 1. Take over jobs whose worker died mid-send.
    const reaped = await collections.letterDeliveries.updateMany(
      { status: "PROCESSING", leaseExpiresAt: { $lt: now } },
      { $set: { status: "QUEUED", updatedAt: now }, $unset: { leaseOwner: "", leaseExpiresAt: "" } },
    );
    result.reaped = reaped.modifiedCount;

    // 2. Promote scheduled deliveries whose time has arrived.
    const promoted = await collections.letterDeliveries.updateMany(
      { status: "SCHEDULED", scheduledAt: { $lte: now } },
      { $set: { status: "QUEUED", updatedAt: now } },
    );
    result.promoted = promoted.modifiedCount;

    // 3. Past the catch-up window unattempted → MISSED (visible, retryable
    //    by an admin — never silently dropped).
    const missed = await collections.letterDeliveries.updateMany(
      {
        status: { $in: ["SCHEDULED", "QUEUED"] },
        attempts: 0,
        scheduledAt: { $lt: new Date(now.getTime() - CATCH_UP_HOURS * HOUR_MS) },
      },
      { $set: { status: "MISSED", skipReason: "Send window expired before the scheduler ran.", updatedAt: now } },
    );
    result.missedMarked = missed.modifiedCount;

    // 4. Plan: due slots → editions → delivery rows.
    const templates = await getTemplates(true);
    for (const template of templates) {
      try {
        const slots = dueSlots(
          template.schedule as Schedule,
          now,
          { catchUpHours: CATCH_UP_HOURS, lookbackDays: template.schedule.kind === "weekly" ? 14 : 7 },
        );
        for (const slot of slots) {
          const edition = await generateEdition(template, slot, now);
          if (!edition) continue;
          const { planned, missed: m } = await planEditionDeliveries(template, edition, slot, now);
          result.plannedEditions += planned;
          result.missedMarked += m;
        }
      } catch (error) {
        result.errors.push(`${template.id}: ${error instanceof Error ? error.message : "planning failed"}`);
      }
    }

    // 5. Work: claim + send up to the batch limit. Remaining jobs are picked
    //    up by the next tick — the queue is durable, nothing is lost.
    const byId = new Map(templates.map((template) => [template.id, template]));
    while (result.claimed < WORKER_BATCH) {
      const delivery = await claimOne(now);
      if (!delivery) break;
      result.claimed += 1;
      const template = byId.get(delivery.templateId) ?? (await getTemplate(delivery.templateId));
      if (!template) {
        await collections.letterDeliveries.updateOne(
          { _id: delivery._id },
          { $set: { status: "SKIPPED", skipReason: "Template removed.", updatedAt: new Date() }, $unset: { leaseOwner: "", leaseExpiresAt: "" } },
        );
        result.skipped += 1;
        continue;
      }
      try {
        const outcome = await sendDelivery(delivery, template);
        result[outcome === "sent" ? "sent" : outcome === "failed" ? "failed" : "skipped"] += 1;
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : "send failed";
        result.errors.push(`${delivery.email}/${delivery.templateId}: ${message}`);
        // Release the lease so a retry can pick it up after backoff.
        await collections.letterDeliveries.updateOne(
          { _id: delivery._id },
          {
            $set: {
              status: "QUEUED",
              failReason: message,
              nextRetryAt: new Date(now.getTime() + backoffMs(delivery.attempts + 1)),
              updatedAt: new Date(),
            },
            $inc: { attempts: 1 },
            $unset: { leaseOwner: "", leaseExpiresAt: "" },
          },
        );
        await attempt(delivery._id, "retry-scheduled", { by: "scheduler", detail: message });
      }
    }

    await collections.schedulerRuns.updateOne(
      { _id: run.insertedId },
      { $set: { finishedAt: new Date(), ...result, runId: undefined } },
    );
    await collections.schedulerState.updateOne(
      { _id: "scheduler" },
      {
        $set: {
          heartbeatAt: new Date(),
          lastRunFinishedAt: new Date(),
          lastRunStatus: "ok",
          lastRunId: run.insertedId,
        },
        $unset: { runningUntil: "", runningBy: "" },
      },
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduler run failed.";
    result.errors.push(message);
    await collections.schedulerRuns.updateOne(
      { _id: run.insertedId },
      { $set: { finishedAt: new Date(), ...result, runId: undefined } },
    );
    await collections.schedulerState.updateOne(
      { _id: "scheduler" },
      {
        $set: { lastRunFinishedAt: new Date(), lastRunStatus: "error", lastRunId: run.insertedId },
        $unset: { runningUntil: "", runningBy: "" },
      },
    );
    return result;
  }
}

// ── Manual operations used by the admin centre ─────────────────────────────

const RETRYABLE: LetterDeliveryDoc["status"][] = ["FAILED", "MISSED", "QUEUED", "SKIPPED", "UNKNOWN", "DELAYED"];

export function retryableFilter(): Filter<LetterDeliveryDoc> {
  return {
    status: { $in: RETRYABLE },
    // Never retry while another worker holds a live lease.
    $or: [
      { leaseExpiresAt: { $exists: false } },
      { leaseExpiresAt: { $lt: new Date() } },
    ],
  };
}

// Queue one delivery for resend — revalidated against subscription and
// suppression before it actually sends, so stale recipients are skipped.
export async function retryDeliveries(
  filter: Filter<LetterDeliveryDoc>,
  by: { userId?: string },
): Promise<{ ok: true; queued: number } | { error: string }> {
  await connect();
  const now = new Date();
  const eligible = await collections.letterDeliveries
    .find({ ...retryableFilter(), ...filter }, { projection: { _id: 1, email: 1, status: 1 } })
    .limit(2000)
    .toArray();
  if (!eligible.length) return { error: "No eligible deliveries match that selection." };

  // Don't requeue recipients who have since unsubscribed or been suppressed.
  const emails = eligible.map((d) => d.email);
  const [suppressed, subs] = await Promise.all([
    collections.suppressions.find({ email: { $in: emails } }, { projection: { email: 1 } }).toArray(),
    collections.subscribers.find({ email: { $in: emails } }).toArray(),
  ]);
  const suppressedSet = new Set(suppressed.map((s) => s.email));
  const letterSets = new Map(
    (subs as unknown as SubscriberRow[]).map((s) => [s.email, new Set(s.letters ?? [])]),
  );
  const ids = eligible
    .filter((d) => !suppressedSet.has(d.email))
    .map((d) => d._id);

  const res = await collections.letterDeliveries.updateMany(
    { _id: { $in: ids } },
    {
      $set: { status: "QUEUED", nextRetryAt: now, source: "manual", updatedAt: now },
      $unset: { failReason: "", skipReason: "", leaseOwner: "", leaseExpiresAt: "" },
    },
  );
  for (const id of ids) {
    await attempt(id, "retry-scheduled", { by: "admin", userId: by.userId, detail: "Manual retry queued." });
  }
  // Subscriptions that vanished entirely get noted too — visibility, not noise.
  const gone = eligible.filter((d) => !letterSets.has(d.email)).length;
  return { ok: true, queued: res.modifiedCount + (gone ? 0 : 0) };
}

// Reconciliation: find expected sends with no delivery row, and demote
// UNKNOWN rows back to QUEUED after an admin confirms nothing was delivered.
export async function reconcileNow(): Promise<{ created: number; requeued: number }> {
  await connect();
  // Re-run the planner — it creates any missing delivery rows via the unique
  // index, which is exactly what "scheduled recipients without jobs" means.
  const tick = await runSchedulerTick("reconcile");
  if ("error" in tick) return { created: 0, requeued: 0 };
  return { created: tick.plannedEditions + tick.queued, requeued: tick.claimed };
}
