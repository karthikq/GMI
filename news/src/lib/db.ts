import { MongoClient, type Document, type ObjectId } from "mongodb";
import { io } from "next/cache";
import { articles, markets, sections, subsections, tickerSlugs } from "./data";

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

let ready: Promise<void> | null = null;

export async function connect(): Promise<void> {
  // Mark every call request-time: Mongo reads (and seed()'s Date.now) must
  // never run inside a prerender pass. Resolves immediately at request time.
  await io();
  ready ??= (async () => {
    await client.connect();
    const { sections: sectionCollection, articles, subscribers, deliveries, users, sessions, bookmarks, reads, invites } = collections;
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
    ]);
    if ((await articles.estimatedDocumentCount()) === 0) {
      const counts = await seed();
      console.log(`Empty database: seeded ${counts.articles} sample articles.`);
    }
    // Older databases only carry the original desks; upsert the canonical
    // section/subsection tree so new categories appear without touching
    // stored stories or admin-made edits.
    await upsertCategoryTree();
  })();
  return ready;
}
