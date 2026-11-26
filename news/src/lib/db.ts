import { MongoClient } from "mongodb";
import { io } from "next/cache";
import { articles, markets, sections, tickerSlugs } from "./data";

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

export const collections = {
  sections: db.collection("sections"),
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
    collections.sections.insertMany(sections.map((section, order) => ({ ...section, order }))),
    collections.articles.insertMany(docs),
    collections.markets.insertMany(markets.map((market, order) => ({ ...market, order }))),
  ]);
  return { articles: docs.length };
}

let ready: Promise<void> | null = null;

export async function connect(): Promise<void> {
  // Mark every call request-time: Mongo reads (and seed()'s Date.now) must
  // never run inside a prerender pass. Resolves immediately at request time.
  await io();
  ready ??= (async () => {
    await client.connect();
    const { sections: sectionCollection, articles, subscribers, deliveries, users, sessions, bookmarks, reads, invites } = collections;
    await Promise.all([
      sectionCollection.createIndex({ slug: 1 }, { unique: true }),
      articles.createIndex({ slug: 1 }, { unique: true }),
      articles.createIndex({ section: 1, publishedAt: -1 }),
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
    // Older databases only carry the original desks; upsert the canonical list
    // so new desks appear without touching their stored stories.
    await Promise.all(
      sections.map((section, order) =>
        collections.sections.updateOne(
          { slug: section.slug },
          {
            $set: { order },
            $setOnInsert: { name: section.name, blurb: section.blurb },
          },
          { upsert: true },
        ),
      ),
    );
  })();
  return ready;
}
