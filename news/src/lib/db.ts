import { MongoClient } from "mongodb";
import { articles, markets, sections, tickerSlugs } from "./data";

const HOUR = 60 * 60 * 1000;

const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };
export const client = (globalForMongo.mongoClient ??= new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
));
export const db = client.db(process.env.MONGODB_DB || "meridian");

export const collections = {
  sections: db.collection("sections"),
  articles: db.collection("articles"),
  markets: db.collection("markets"),
  subscribers: db.collection("subscribers"),
  users: db.collection("users"),
  sessions: db.collection("sessions"),
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

export function connect(): Promise<void> {
  ready ??= (async () => {
    await client.connect();
    const { sections, articles, subscribers, users, sessions } = collections;
    await Promise.all([
      sections.createIndex({ slug: 1 }, { unique: true }),
      articles.createIndex({ slug: 1 }, { unique: true }),
      articles.createIndex({ section: 1, publishedAt: -1 }),
      articles.createIndex({ publishedAt: -1 }),
      articles.createIndex({ reads: -1 }),
      subscribers.createIndex({ email: 1 }, { unique: true }),
      users.createIndex({ email: 1 }, { unique: true }),
      sessions.createIndex({ token: 1 }, { unique: true }),
      // Sessions clean themselves up once they expire.
      sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
    if ((await articles.estimatedDocumentCount()) === 0) {
      const counts = await seed();
      console.log(`Empty database: seeded ${counts.articles} sample articles.`);
    }
  })();
  return ready;
}
