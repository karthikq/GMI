import { MongoClient, type Document, type ObjectId } from "mongodb";
import { io } from "next/cache";
import { articles, markets, sections, subsections, tickerSlugs } from "./data";
import { defaultSectionConfig, type CollectionsConfig, type LayoutBlock } from "./layouts";

const HOUR = 60 * 60 * 1000;

const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };
export const client = (globalForMongo.mongoClient ??= new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
));
export const db = client.db(process.env.MONGODB_DB || "meridian");

// Older documents may predate `letters`; readers guard accordingly.
export type SubscriberDoc = {
  email: string;
  subscribedAt: Date;
  letters: string[];
  // Per-letter email format picks, keyed by letter id.
  letterFormats?: Record<string, string>;
  // Per-letter delivery time overrides the reader picked, keyed by letter id.
  letterTimes?: Record<string, string>;
  // One global delivery time ("HH:MM") applied to every letter — when set it
  // wins over letterTimes and the template default.
  sendTime?: string;
  // Last local date (YYYY-MM-DD) each letter was delivered — dedupes the cron run.
  letterLastSent?: Record<string, string>;
  // IANA zone the reader's letterTimes are expressed in (captured at pick time).
  timeZone?: string;
};

// One row per newsletter email the app attempted, written after every send so
// the admin dashboard can tell "sent" from "never went out" per reader.
export type DeliveryDoc = {
  email: string;
  letter: string;
  kind: "confirm" | "issue";
  status: "sent" | "skipped" | "failed";
  sentAt: Date;
};

// Categories are stored in the `sections` collection: a document with no
// `parent` is a main section, one with `parent` set to a section's _id is a
// subsection. The shape allows deeper nesting later, though the public
// routes only render two levels today.
export type CategoryDoc = Document & {
  name: string;
  slug: string;
  blurb: string;
  parent?: ObjectId | null;
  order: number;
  active?: boolean;
  showInNav?: boolean;
  featured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

// ── Newsletter delivery centre ─────────────────────────────────────────────
// Durable scheduling: templates → editions → per-recipient deliveries, driven
// by an external trigger hitting /api/cron/deliver. Everything is keyed so a
// server restart, a missed window, or a duplicate run can never lose or
// double-send a newsletter.

export type LetterTemplateDoc = Document & {
  id: string; // stable public id — subscribers' letters[] references this
  name: string;
  description: string;
  cadence: string;
  schedule: { kind: string; dayOfWeek?: number; time: string; timeZone: string };
  topics: string[];
  deskSlug?: string;
  articleCount: number; // target stories per edition (5–15, default 7)
  formats: string[]; // current-format ids; legacy ids normalise at read time
  defaultFormat?: string; // format used when a subscriber never picked one
  premium: boolean;
  active: boolean;
  onEmpty: "skip" | "send-with-fallback" | "hold";
  minArticles: number;
  // Article-selection config (windows, desk fallback, premium, resend gap)
  // and optional content blocks — see letterTemplates.ts for the shape.
  selection?: Record<string, unknown>;
  content?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

// One generated issue per template per period (a local date, an ISO week, or
// an explicit event key). The article picks are frozen at generation so a
// manual retry later resends THIS edition, not whatever is newest then.
export type LetterEditionDoc = Document & {
  templateId: string;
  periodKey: string; // "2026-11-27" | "2026-W48" | "event-<slug>"
  editionDate: string; // display label, e.g. "FRI, NOV 27, 2026"
  subject: string;
  articleSlugs: string[];
  articleCount: number;
  schedule: { kind: string; dayOfWeek?: number; time: string; timeZone: string };
  scheduledAt: Date; // template-level send instant (UTC)
  status: "ready" | "skipped" | "empty" | "hold";
  skipReason?: string;
  // True when the picker couldn't reach the minimum five unique stories —
  // surfaced in the admin dashboard for manual review.
  insufficient?: boolean;
  createdAt: Date;
};

// A reader's answer to a newsletter poll or quiz — written by /engage pages
// the Reader's Edition format links to.
export type EngagementDoc = Document & {
  kind: "poll" | "quiz";
  letterId: string;
  question: string;
  option: number;
  label: string;
  correct?: boolean;
  email?: string;
  at: Date;
};

export type DeliveryStatus =
  | "SCHEDULED"
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "MISSED"
  | "DELAYED"
  | "BOUNCED"
  | "SKIPPED"
  | "SUPPRESSED"
  | "CANCELLED"
  | "UNKNOWN";

export type LetterDeliveryDoc = Document & {
  templateId: string;
  editionId: ObjectId;
  subscriberId?: ObjectId;
  userId?: ObjectId;
  email: string;
  name?: string;
  format: string;
  scheduledAt: Date; // recipient-effective send instant (their time, their zone)
  sentAt?: Date;
  deliveredAt?: Date;
  status: DeliveryStatus;
  providerMessageId?: string;
  lastOpenedAt?: Date;
  lastClickedAt?: Date;
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  providerCode?: string;
  failReason?: string;
  skipReason?: string;
  source: "automatic" | "manual";
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryAttemptDoc = Document & {
  deliveryId: ObjectId;
  at: Date;
  by: "scheduler" | "admin" | "webhook";
  userId?: string;
  outcome: "claim" | "sent" | "failed" | "skipped" | "retry-scheduled" | "event" | "suppressed";
  detail?: string;
  providerStatus?: number;
  providerMessageId?: string;
};

export type WebhookEventDoc = Document & {
  provider: string;
  eventId: string; // messageId + event + ts — dedupe key
  event: string;
  messageId?: string;
  email?: string;
  tsEvent?: number;
  payload: unknown;
  receivedAt: Date;
  processedAt?: Date;
  deliveryId?: ObjectId;
  result?: string;
};

export type SchedulerRunDoc = Document & {
  trigger: "cron" | "manual" | "reconcile";
  workerId: string;
  startedAt: Date;
  finishedAt?: Date;
  plannedEditions: number;
  queued: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  missedMarked: number;
  errors: string[];
};

// Singleton document (_id "scheduler") — heartbeat + last good tick.
export type SchedulerStateDoc = Document & {
  _id: string;
  heartbeatAt: Date;
  runningUntil?: Date;
  runningBy?: string;
  lastRunStartedAt?: Date;
  lastRunFinishedAt?: Date;
  lastRunStatus?: "ok" | "error";
  lastRunId?: ObjectId;
  timeZone: string;
};

// Permanent and provider-driven opt-outs: hard bounces, complaints and
// one-click unsubscribes land here and are re-checked at send time.
export type SuppressionDoc = Document & {
  email: string;
  reason: "bounce" | "complaint" | "unsubscribe" | "blocked" | "invalid";
  detail?: string;
  createdAt: Date;
};

export type AuditDoc = Document & {
  userId?: string;
  userEmail?: string;
  action: string;
  target: string;
  detail?: string;
  at: Date;
};

// One document per section (subsectionSlug null) or per subsection override —
// the editorial block program the section page renders. Documents missing
// entirely fall back to defaultSectionConfig() at read time.
export type LayoutDoc = Document & {
  sectionSlug: string;
  subsectionSlug: string | null;
  blocks: LayoutBlock[];
  collections: CollectionsConfig;
  createdAt?: Date;
  updatedAt?: Date;
};

export const collections = {
  sections: db.collection<CategoryDoc>("sections"),
  articles: db.collection("articles"),
  markets: db.collection("markets"),
  subscribers: db.collection<SubscriberDoc>("subscribers"),
  deliveries: db.collection<DeliveryDoc>("deliveries"),
  users: db.collection("users"),
  sessions: db.collection("sessions"),
  bookmarks: db.collection("bookmarks"),
  reads: db.collection("reads"),
  invites: db.collection("invites"),
  settings: db.collection<{ _id: string; value: string }>("settings"),
  layouts: db.collection<LayoutDoc>("layouts"),
  letterTemplates: db.collection<LetterTemplateDoc>("letterTemplates"),
  letterEditions: db.collection<LetterEditionDoc>("letterEditions"),
  letterDeliveries: db.collection<LetterDeliveryDoc>("letterDeliveries"),
  deliveryAttempts: db.collection<DeliveryAttemptDoc>("deliveryAttempts"),
  webhookEvents: db.collection<WebhookEventDoc>("webhookEvents"),
  schedulerRuns: db.collection<SchedulerRunDoc>("schedulerRuns"),
  schedulerState: db.collection<SchedulerStateDoc>("schedulerState"),
  suppressions: db.collection<SuppressionDoc>("suppressions"),
  auditLog: db.collection<AuditDoc>("auditLog"),
  engagements: db.collection<EngagementDoc>("engagements"),
};

// Replaces sections, articles and markets with the sample data. Subscribers are kept.
async function seed() {
  const now = Date.now();
  const docs = articles.map(({ hoursAgo, ...article }) => {
    const tickerOrder = tickerSlugs.indexOf(article.slug);
    return {
      ...article,
      publishedAt: new Date(now - hoursAgo * HOUR),
      readMinutes: Math.max(1, Math.round(article.body.join(" ").split(/\s+/).length / 60)),
      ...(tickerOrder >= 0 ? { tickerOrder } : {}),
    };
  });

  await Promise.all([
    collections.sections.deleteMany({}),
    collections.articles.deleteMany({}),
    collections.markets.deleteMany({}),
  ]);
  await Promise.all([
    collections.sections.insertMany(
      sections.map((section, order) => ({
        ...section,
        parent: null,
        order,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    ),
    collections.articles.insertMany(docs),
    collections.markets.insertMany(markets.map((market, order) => ({ ...market, order }))),
  ]);
  return { articles: docs.length };
}

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Upserts the canonical sections/subsections tree without touching existing
// categories or their articles: order is refreshed on every run while names,
// blurbs, flags and SEO fields are only written on insert, so admin edits
// survive. Safe to run repeatedly.
async function upsertCategoryTree() {
  const { sections: sectionCollection } = collections;
  const now = new Date();
  await Promise.all(
    sections.map((section, order) =>
      sectionCollection.updateOne(
        { parent: null, slug: section.slug },
        {
          $set: { order, updatedAt: now },
          $setOnInsert: {
            name: section.name,
            blurb: section.blurb,
            parent: null,
            active: true,
            showInNav: true,
            featured: false,
            createdAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
  const parents = await sectionCollection
    .find({ parent: null, slug: { $in: sections.map((s) => s.slug) } }, { projection: { slug: 1 } })
    .toArray();
  const parentIds = new Map(parents.map((doc) => [doc.slug, doc._id]));
  const writes = sections.flatMap((section) => {
    const parentId = parentIds.get(section.slug);
    if (!parentId) return [];
    return (subsections[section.slug] ?? []).map((sub, order) =>
      sectionCollection.updateOne(
        { parent: parentId, slug: sub.slug ?? slugify(sub.name) },
        {
          $set: { order, updatedAt: now },
          $setOnInsert: {
            name: sub.name,
            blurb: `Latest ${sub.name} news, analysis and updates.`,
            parent: parentId,
            active: true,
            showInNav: true,
            featured: order < 8,
            createdAt: now,
          },
        },
        { upsert: true },
      ),
    );
  });
  await Promise.all(writes);
}

// Writes the stock block program for every canonical section exactly once —
// $setOnInsert means admin layout edits are never clobbered on re-runs.
async function upsertLayoutDefaults() {
  const now = new Date();
  await Promise.all(
    sections.map((section) => {
      const config = defaultSectionConfig(section.slug, section.name);
      return collections.layouts.updateOne(
        { sectionSlug: section.slug, subsectionSlug: null },
        {
          $setOnInsert: {
            sectionSlug: section.slug,
            subsectionSlug: null,
            blocks: config.blocks,
            collections: config.collections,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }),
  );
}

// Seeds the newsletter template catalogue exactly once — $setOnInsert so
// admin edits (renames, schedule changes, activation) are never clobbered.
async function upsertLetterTemplates() {
  const { seedTemplates } = await import("./letterTemplates");
  const now = new Date();
  await Promise.all(
    seedTemplates().map((template) =>
      collections.letterTemplates.updateOne(
        { id: template.id },
        { $setOnInsert: { ...template, createdAt: now, updatedAt: now } },
        { upsert: true },
      ),
    ),
  );
}

let ready: Promise<void> | null = null;

export async function connect(): Promise<void> {
  // Mark every call request-time: Mongo reads (and seed()'s Date.now) must
  // never run inside a prerender pass. Resolves immediately at request time.
  await io();
  ready ??= (async () => {
    await client.connect();
    const { sections: sectionCollection, articles, subscribers, deliveries, users, sessions, bookmarks, reads, invites, layouts, letterTemplates, letterEditions, letterDeliveries, deliveryAttempts, webhookEvents, schedulerRuns, suppressions, auditLog } = collections;
    // The original global unique slug index predates subsections — two
    // different sections may now own a child with the same slug, so
    // uniqueness is enforced per parent instead.
    await sectionCollection.dropIndex("slug_1").catch(() => {});
    await Promise.all([
      sectionCollection.createIndex({ parent: 1, slug: 1 }, { unique: true }),
      sectionCollection.createIndex({ parent: 1, order: 1 }),
      articles.createIndex({ slug: 1 }, { unique: true }),
      articles.createIndex({ section: 1, publishedAt: -1 }),
      articles.createIndex({ sectionId: 1, publishedAt: -1 }),
      articles.createIndex({ subsectionId: 1, publishedAt: -1 }),
      articles.createIndex({ publishedAt: -1 }),
      articles.createIndex({ reads: -1 }),
      subscribers.createIndex({ email: 1 }, { unique: true }),
      // The dashboard reads the newest delivery per reader/letter pair.
      deliveries.createIndex({ email: 1, letter: 1, sentAt: -1 }),
      users.createIndex({ email: 1 }, { unique: true }),
      // Case-insensitive; Google-only accounts have no username.
      users.createIndex(
        { username: 1 },
        {
          unique: true,
          collation: { locale: "en", strength: 2 },
          partialFilterExpression: { username: { $type: "string" } },
        },
      ),
      sessions.createIndex({ token: 1 }, { unique: true }),
      // Sessions clean themselves up once they expire.
      sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      bookmarks.createIndex({ userId: 1, slug: 1 }, { unique: true }),
      reads.createIndex({ userId: 1, slug: 1 }, { unique: true }),
      reads.createIndex({ userId: 1, readAt: -1 }),
      invites.createIndex({ email: 1 }, { unique: true }),
      layouts.createIndex({ sectionSlug: 1, subsectionSlug: 1 }, { unique: true }),
      letterTemplates.createIndex({ id: 1 }, { unique: true }),
      letterEditions.createIndex({ templateId: 1, periodKey: 1 }, { unique: true }),
      letterEditions.createIndex({ scheduledAt: 1 }),
      // One delivery row per edition per recipient — the dedupe backbone that
      // makes retries and duplicate ticks safe.
      letterDeliveries.createIndex({ editionId: 1, email: 1 }, { unique: true }),
      letterDeliveries.createIndex({ status: 1, nextRetryAt: 1 }),
      letterDeliveries.createIndex({ status: 1, scheduledAt: 1 }),
      letterDeliveries.createIndex({ email: 1, scheduledAt: -1 }),
      letterDeliveries.createIndex({ templateId: 1, scheduledAt: -1 }),
      letterDeliveries.createIndex({ leaseExpiresAt: 1 }, { sparse: true }),
      deliveryAttempts.createIndex({ deliveryId: 1, at: -1 }),
      webhookEvents.createIndex({ eventId: 1 }, { unique: true }),
      webhookEvents.createIndex({ messageId: 1 }),
      schedulerRuns.createIndex({ startedAt: -1 }),
      suppressions.createIndex({ email: 1 }, { unique: true }),
      collections.engagements.createIndex({ letterId: 1, kind: 1, at: -1 }),
      auditLog.createIndex({ at: -1 }),
    ]);
    if ((await articles.estimatedDocumentCount()) === 0) {
      const counts = await seed();
      console.log(`Empty database: seeded ${counts.articles} sample articles.`);
    }
    // Older databases only carry the original desks; upsert the canonical
    // section/subsection tree so new categories appear without touching
    // stored stories or admin-made edits.
    await upsertCategoryTree();
    await upsertLayoutDefaults();
    await upsertLetterTemplates();
  })();
  return ready;
}
