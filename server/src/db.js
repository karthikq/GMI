import { MongoClient } from "mongodb";

export const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
export const db = client.db(process.env.MONGODB_DB || "meridian");

export const collections = {
  sections: db.collection("sections"),
  articles: db.collection("articles"),
  markets: db.collection("markets"),
  subscribers: db.collection("subscribers"),
};

export async function connect() {
  await client.connect();
  const { sections, articles, subscribers } = collections;
  // The original global unique slug index predates subsections — two
  // different sections may now own a child with the same slug, so
  // uniqueness is enforced per parent instead.
  await sections.dropIndex("slug_1").catch(() => {});
  await Promise.all([
    sections.createIndex({ parent: 1, slug: 1 }, { unique: true }),
    sections.createIndex({ parent: 1, order: 1 }),
    articles.createIndex({ slug: 1 }, { unique: true }),
    articles.createIndex({ section: 1, publishedAt: -1 }),
    articles.createIndex({ sectionId: 1, publishedAt: -1 }),
    articles.createIndex({ subsectionId: 1, publishedAt: -1 }),
    articles.createIndex({ publishedAt: -1 }),
    articles.createIndex({ reads: -1 }),
    subscribers.createIndex({ email: 1 }, { unique: true }),
  ]);
}
