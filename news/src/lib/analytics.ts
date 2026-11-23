import { io } from "next/cache";
import { collections, connect } from "./db";

// Days are bucketed in the newsroom's timezone so "today" matches the desk's clock.
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayOf = (date: Date) => dayFormat.format(date);

export type StoryRow = {
  slug: string;
  title: string;
  sectionName: string;
  publishedAt: string;
  scheduled: boolean;
  readers: number;
};

// Stories and their reader counts. `authorId` limits the set to one writer's stories.
async function loadStories(authorId?: string) {
  await connect();
  await io();
  const [articles, sections] = await Promise.all([
    collections.articles
      .find(authorId ? { authorId } : {}, { projection: { _id: 0, slug: 1, title: 1, section: 1, publishedAt: 1 } })
      .sort({ publishedAt: -1 })
      .toArray(),
    collections.sections.find({}, { projection: { _id: 0, slug: 1, name: 1 } }).toArray(),
  ]);
  const slugs = articles.map((a) => a.slug as string);
  const reads = slugs.length
    ? await collections.reads
        .find({ slug: { $in: slugs } }, { projection: { _id: 0, slug: 1, firstReadAt: 1 } })
        .toArray()
    : [];

  const names = new Map(sections.map((s) => [s.slug as string, s.name as string]));
  const readers = new Map<string, number>();
  for (const read of reads) readers.set(read.slug as string, (readers.get(read.slug as string) ?? 0) + 1);

  const now = Date.now();
  const rows: StoryRow[] = articles.map((a) => {
    const publishedAt = a.publishedAt as Date;
    return {
      slug: a.slug as string,
      title: a.title as string,
      sectionName: names.get(a.section as string) ?? (a.section as string),
      publishedAt: publishedAt.toISOString(),
      scheduled: publishedAt.getTime() > now,
      readers: readers.get(a.slug as string) ?? 0,
    };
  });
  return { rows, reads };
}

export async function fetchStoryList(authorId: string): Promise<StoryRow[]> {
  return (await loadStories(authorId)).rows;
}

export async function fetchDashboard(authorId?: string) {
  const { rows, reads } = await loadStories(authorId);
  const published = rows.filter((row) => !row.scheduled);

  const days = Array.from({ length: 14 }, (_, i) => dayOf(new Date(Date.now() - (13 - i) * 86_400_000)));
  const newReaders = new Map(days.map((day) => [day, 0]));
  for (const read of reads) {
    const day = read.firstReadAt ? dayOf(read.firstReadAt as Date) : null;
    if (day && newReaders.has(day)) newReaders.set(day, (newReaders.get(day) ?? 0) + 1);
  }

  const desks = new Map<string, number>();
  for (const row of rows) desks.set(row.sectionName, (desks.get(row.sectionName) ?? 0) + row.readers);

  const totalReaders = reads.length;
  return {
    totals: {
      stories: rows.length,
      published: published.length,
      scheduled: rows.length - published.length,
      readers: totalReaders,
      perStory: published.length ? Math.round((totalReaders / published.length) * 10) / 10 : 0,
    },
    daily: days.map((day) => ({ day, count: newReaders.get(day) ?? 0 })),
    desks: [...desks].map(([name, readers]) => ({ name, readers })).sort((a, b) => b.readers - a.readers),
    top: [...published].sort((a, b) => b.readers - a.readers).slice(0, 8),
  };
}
