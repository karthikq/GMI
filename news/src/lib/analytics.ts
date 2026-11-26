import { ObjectId } from "mongodb";
import { io } from "next/cache";
import { collections, connect } from "./db";
import { EDITORIAL_ROLES } from "./roles";

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
  views: number;
  authorId?: string;
  author: string;
};

// Stories and their reader counts. `authorId` limits the set to one writer's stories.
async function loadStories(authorId?: string) {
  await connect();
  await io();
  const [articles, sections] = await Promise.all([
    collections.articles
      .find(authorId ? { authorId } : {}, {
        projection: {
          _id: 0,
          slug: 1,
          title: 1,
          section: 1,
          publishedAt: 1,
          authorId: 1,
          author: 1,
          views: 1,
        },
      })
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
      views: typeof a.views === "number" ? a.views : 0,
      authorId: typeof a.authorId === "string" ? a.authorId : undefined,
      author: (a.author as string | undefined) ?? "Newsroom",
    };
  });
  return { rows, reads };
}

function summarize(rows: StoryRow[], reads: unknown[]) {
  const published = rows.filter((row) => !row.scheduled);

  const days = Array.from({ length: 14 }, (_, i) => dayOf(new Date(Date.now() - (13 - i) * 86_400_000)));
  const newReaders = new Map(days.map((day) => [day, 0]));
  for (const read of reads) {
    const firstReadAt = (read as { firstReadAt?: unknown }).firstReadAt;
    const day = firstReadAt instanceof Date ? dayOf(firstReadAt) : null;
    if (day && newReaders.has(day)) newReaders.set(day, (newReaders.get(day) ?? 0) + 1);
  }

  const desks = new Map<string, number>();
  for (const row of rows) desks.set(row.sectionName, (desks.get(row.sectionName) ?? 0) + row.readers);

  const totalReaders = reads.length;
  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  return {
    totals: {
      stories: rows.length,
      published: published.length,
      scheduled: rows.length - published.length,
      readers: totalReaders,
      views: totalViews,
      perStory: published.length ? Math.round((totalReaders / published.length) * 10) / 10 : 0,
    },
    daily: days.map((day) => ({ day, count: newReaders.get(day) ?? 0 })),
    desks: [...desks].map(([name, readers]) => ({ name, readers })).sort((a, b) => b.readers - a.readers),
    top: [...published].sort((a, b) => b.readers - a.readers).slice(0, 8),
  };
}

export async function fetchStoryList(authorId: string): Promise<StoryRow[]> {
  return (await loadStories(authorId)).rows;
}

export async function fetchDashboard(authorId: string) {
  const { rows, reads } = await loadStories(authorId);
  return summarize(rows, reads);
}

export type StaffPerformanceRow = {
  id: string;
  name: string;
  role: string;
  stories: number;
  published: number;
  scheduled: number;
  readers: number;
  views: number;
};

export type AdminDashboard = Awaited<ReturnType<typeof summarize>> & {
  audience: {
    accounts: number;
    editorial: number;
    subscriberAddresses: number;
    subscriptions: number;
    emailsSent: number;
    emailsFailed: number;
    emailsSkipped: number;
  };
  staff: StaffPerformanceRow[];
};

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { rows, reads } = await loadStories();
  const authorIds = [...new Set(rows.map((row) => row.authorId).filter(Boolean))] as string[];
  const objectIds = authorIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));

  const [authors, accounts, editorial, subscriberAddresses, subscriptionAgg, deliveryAgg] =
    await Promise.all([
      objectIds.length
        ? collections.users
            .find({ _id: { $in: objectIds } }, { projection: { name: 1, role: 1 } })
            .toArray()
        : Promise.resolve([]),
      collections.users.countDocuments({}),
      collections.users.countDocuments({ role: { $in: EDITORIAL_ROLES } }),
      collections.subscribers.countDocuments({}),
      collections.subscribers
        .aggregate<{ total: number }>([
          { $project: { count: { $size: { $ifNull: ["$letters", []] } } } },
          { $group: { _id: null, total: { $sum: "$count" } } },
        ])
        .toArray(),
      collections.deliveries
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

  const authorNames = new Map(authors.map((author) => [String(author._id), author]));
  const deliveryCounts = new Map(deliveryAgg.map((row) => [row._id, row.count]));
  const staffById = new Map<string, StaffPerformanceRow>();

  for (const row of rows) {
    const id = row.authorId ?? `byline:${row.author}`;
    const account = row.authorId ? authorNames.get(row.authorId) : undefined;
    const item = staffById.get(id) ?? {
      id,
      name: (account?.name as string | undefined) ?? row.author,
      role: (account?.role as string | undefined) ?? "Contributor",
      stories: 0,
      published: 0,
      scheduled: 0,
      readers: 0,
      views: 0,
    };
    item.stories += 1;
    if (row.scheduled) item.scheduled += 1;
    else item.published += 1;
    item.readers += row.readers;
    item.views += row.views;
    staffById.set(id, item);
  }

  return {
    ...summarize(rows, reads),
    audience: {
      accounts,
      editorial,
      subscriberAddresses,
      subscriptions: subscriptionAgg[0]?.total ?? 0,
      emailsSent: deliveryCounts.get("sent") ?? 0,
      emailsFailed: deliveryCounts.get("failed") ?? 0,
      emailsSkipped: deliveryCounts.get("skipped") ?? 0,
    },
    staff: [...staffById.values()].sort((a, b) => b.readers - a.readers || b.views - a.views).slice(0, 8),
  };
}
