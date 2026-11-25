import type { ObjectId } from "mongodb";
import { io } from "next/cache";
import { collections, connect } from "./db";

/* Per-reader activity: saved stories (bookmarks) and the reading log (reads).
   One document per user+slug in each collection, so re-saving or re-reading
   just updates the row rather than piling up duplicates. */

export async function toggleBookmark(
  userId: ObjectId,
  slug: string,
  section: string,
): Promise<boolean> {
  await connect();
  const filter = { userId, slug };
  const existing = await collections.bookmarks.findOne(filter, {
    projection: { _id: 1 },
  });
  if (existing) {
    await collections.bookmarks.deleteOne(filter);
    return false;
  }
  await collections.bookmarks.insertOne({ ...filter, section, savedAt: new Date() });
  return true;
}

export async function isBookmarked(userId: ObjectId, slug: string): Promise<boolean> {
  await connect();
  const hit = await collections.bookmarks.findOne(
    { userId, slug },
    { projection: { _id: 1 } },
  );
  return Boolean(hit);
}

export async function recordRead(
  userId: ObjectId,
  slug: string,
  section: string,
): Promise<void> {
  await connect();
  await collections.reads.updateOne(
    { userId, slug },
    {
      $set: { section, readAt: new Date() },
      $setOnInsert: { firstReadAt: new Date() },
    },
    { upsert: true },
  );
}

// Every article open counts a view, including anonymous visitors. The counter
// lives on the article so list views and the author dashboard can read it.
export async function recordView(slug: string): Promise<void> {
  await connect();
  await collections.articles.updateOne({ slug }, { $inc: { views: 1 } });
}

export async function getSavedSlugs(userId: ObjectId, limit = 12): Promise<string[]> {
  await connect();
  const docs = await collections.bookmarks
    .find({ userId }, { projection: { slug: 1 } })
    .sort({ savedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => d.slug);
}

export async function getRecentReadSlugs(userId: ObjectId, limit = 8): Promise<string[]> {
  await connect();
  const docs = await collections.reads
    .find({ userId }, { projection: { slug: 1 } })
    .sort({ readAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => d.slug);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export type ReaderStats = {
  storiesRead: number;
  saved: number;
  streak: number;
  desks: Set<string>;
};

// Counts the reading log plus a day streak: consecutive calendar days with at
// least one read, ending today (or yesterday — today might just not have started).
export async function getReaderStats(userId: ObjectId): Promise<ReaderStats> {
  await connect();
  await io();
  const [savedDocs, readDocs] = await Promise.all([
    collections.bookmarks
      .find({ userId }, { projection: { section: 1 } })
      .toArray(),
    collections.reads
      .find({ userId }, { projection: { section: 1, readAt: 1 } })
      .toArray(),
  ]);

  const days = new Set(readDocs.map((r) => dayKey(r.readAt as Date)));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const desks = new Set<string>();
  for (const doc of [...readDocs, ...savedDocs]) {
    if (doc.section) desks.add(doc.section);
  }
  return { storiesRead: readDocs.length, saved: savedDocs.length, streak, desks };
}
