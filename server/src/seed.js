import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sections as canonicalSections, subsections } from "./categories.js";
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

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Upserts the canonical sections/subsections tree without touching existing
// categories or their articles: order is refreshed on every run while names,
// blurbs, flags and SEO fields are only written on insert, so admin edits
// survive. Safe to run repeatedly.
export async function seedCategories() {
  const now = new Date();
  await Promise.all(
    canonicalSections.map((section, order) =>
      collections.sections.updateOne(
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
  const parents = await collections.sections
    .find(
      { parent: null, slug: { $in: canonicalSections.map((s) => s.slug) } },
      { projection: { slug: 1 } },
    )
    .toArray();
  const parentIds = new Map(parents.map((doc) => [doc.slug, doc._id]));
  const writes = canonicalSections.flatMap((section) => {
    const parentId = parentIds.get(section.slug);
    if (!parentId) return [];
    return (subsections[section.slug] ?? []).map((sub, order) =>
      collections.sections.updateOne(
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
  return { sections: canonicalSections.length, subsections: writes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connect();
  const counts = await seed();
  await seedCategories();
  console.log(`Seeded ${counts.articles} articles; imported ${counts.subscribers} saved subscribers.`);
  await client.close();
}
