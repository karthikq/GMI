import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { articles, markets, sections, tickerSlugs } from "./data.js";
import { client, collections, connect } from "./db.js";

const HOUR = 60 * 60 * 1000;
// Subscribers saved before the move to MongoDB.
const SUBSCRIBERS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "subscribers.json");

async function importSubscribers() {
  let saved;
  try {
    saved = JSON.parse(await readFile(SUBSCRIBERS_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
  if (!saved.length) return 0;
  await collections.subscribers.bulkWrite(
    saved.map(({ email, subscribedAt }) => ({
      updateOne: {
        filter: { email },
        update: { $setOnInsert: { email, subscribedAt: new Date(subscribedAt) } },
        upsert: true,
      },
    })),
  );
  return saved.length;
}

// Replaces sections, articles and markets with the sample data. Subscribers are kept.
export async function seed() {
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
  return { articles: docs.length, subscribers: await importSubscribers() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connect();
  const counts = await seed();
  console.log(`Seeded ${counts.articles} articles; imported ${counts.subscribers} saved subscribers.`);
  await client.close();
}
