import { io } from "next/cache";
import type { Article, Edition, HomeData, Market, Section, TickerItem, Weather } from "./api";
import { uploadImage } from "./cloudinary";
import { collections, connect } from "./db";

type StoredArticle = {
  slug: string;
  section: string;
  title: string;
  dek: string;
  author: string;
  city: string;
  reads: number;
  readMinutes: number;
  lead?: string;
  body: string[];
  tags?: string[];
  sources?: { label: string; url: string }[];
  related?: string[];
  seo?: { title?: string; description?: string };
  breaking?: boolean;
  image?: string;
  publishedAt: Date;
  tickerOrder?: number;
};

const HOUR = 60 * 60 * 1000;
const DESKS = ["world", "business", "technology", "culture", "science"];
const SEARCH_FIELDS = ["title", "dek", "author", "city", "lead", "body"];
// List views never show the story text, so it is left out of those queries.
const LIST = { projection: { body: 0, lead: 0 } };
const HIDDEN = { projection: { _id: 0, order: 0 } };
// Scheduled stories stay out of every list until their publish time passes.
const PUBLISHED = () => ({ publishedAt: { $lte: new Date() } });

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ROLES: Record<string, string> = {
  world: "Foreign correspondent",
  business: "Business reporter",
  technology: "Technology reporter",
  culture: "Culture writer",
  science: "Science correspondent",
  opinion: "Columnist",
  "in-pictures": "Staff photographer",
  longform: "Senior writer",
};

const getSectionDocs = () => collections.sections.find({}, HIDDEN).sort({ order: 1 }).toArray();
const getMarketDocs = () => collections.markets.find({}, HIDDEN).sort({ order: 1 }).toArray();
const sectionNames = async () => new Map((await getSectionDocs()).map((s) => [s.slug, s.name]));

// Extra fields only the article page needs.
function details(article: StoredArticle, sectionName: string) {
  const role = ROLES[article.section] ?? "Staff writer";
  return {
    authorRole: role,
    authorBio: `${article.author} is a ${role.toLowerCase()} at Good Morning Indian, based in ${article.city}. Their reporting appears on the ${sectionName} desk.`,
    caption: `${article.city}. Photograph: Good Morning Indian`,
    tags: article.tags?.length ? article.tags : [sectionName, article.city],
    ...(article.body.length >= 4
      ? {
          inlineImage: `https://picsum.photos/seed/${article.slug}-inline/1200/675`,
          inlineCaption: `On the ground in ${article.city}. Photograph: Good Morning Indian`,
        }
      : {}),
  };
}

function timeAgo(date: Date) {
  const hours = Math.floor((Date.now() - date.getTime()) / HOUR);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Covers uploaded through the news API are stored as paths on that server;
// absolute URLs and inline data URLs are used as-is. On Vercel the /uploads
// rewrite serves them same-origin, so no base URL is needed there.
const API_URL =
  process.env.NEWS_API_URL ?? (process.env.VERCEL ? "" : "http://localhost:4000");

function present(
  article: StoredArticle,
  names: Map<string, string>,
  { full = false } = {},
): Article {
  const sectionName = names.get(article.section) ?? article.section;
  const image = !article.image
    ? `https://picsum.photos/seed/${article.slug}/1200/800`
    : article.image.startsWith("/")
      ? `${API_URL}${article.image}`
      : article.image;
  return {
    slug: article.slug,
    section: article.section,
    sectionName,
    title: article.title,
    dek: article.dek,
    author: article.author,
    city: article.city,
    image,
    publishedAt: article.publishedAt.toISOString(),
    publishedTime: timeFormat.format(article.publishedAt),
    ago: timeAgo(article.publishedAt),
    readMinutes: article.readMinutes,
    reads: article.reads,
    status: article.publishedAt.getTime() > Date.now() ? "scheduled" : "published",
    ...(full
      ? {
          body: article.lead ? [`<p>${escapeHtml(article.lead)}</p>`, ...article.body] : article.body,
          breaking: Boolean(article.breaking),
          seo: article.seo,
          sources: article.sources,
          ...details(article, sectionName),
        }
      : {}),
  };
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const WEATHER_LOCATION = process.env.WEATHER_LOCATION || "Bengaluru";
const WEATHER_TTL = 10 * 60 * 1000;
let weatherCache: { at: number; data: Weather | null } = { at: 0, data: null };

async function getWeather(): Promise<Weather | null> {
  if (weatherCache.data && Date.now() - weatherCache.at < WEATHER_TTL) return weatherCache.data;
  if (!process.env.WEATHER_API_KEY) return null;

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.search = new URLSearchParams({
    key: process.env.WEATHER_API_KEY,
    q: WEATHER_LOCATION,
    days: "3",
    aqi: "no",
    alerts: "yes",
  }).toString();

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`WeatherAPI responded ${response.status}`);
    const { location, current, forecast, alerts } = await response.json();
    const data: Weather = {
      city: location.name,
      temperature: `${Math.round(current.temp_c)}°C`,
      summary: `${current.condition.text}, wind ${current.wind_dir} ${Math.round(current.wind_kph)} km/h`,
      forecast: forecast.forecastday.map(
        ({
          date,
          day,
        }: {
          date: string;
          day: {
            maxtemp_c: number;
            mintemp_c: number;
            condition: { text: string };
            daily_chance_of_rain: number;
          };
        }) => ({
          date,
          high: Math.round(day.maxtemp_c),
          low: Math.round(day.mintemp_c),
          condition: day.condition.text,
          chanceOfRain: day.daily_chance_of_rain,
        }),
      ),
      alerts: (alerts?.alert ?? []).map((a: { headline: string; severity: string }) => ({ headline: a.headline, severity: a.severity })),
    };
    weatherCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error("Weather fetch failed:", (error as Error).message);
    return weatherCache.data;
  }
}

function editionName(hour: number) {
  if (hour < 12) return "Morning Edition";
  if (hour < 17) return "Afternoon Edition";
  return "Evening Edition";
}

export async function fetchSections(): Promise<Section[]> {
  await connect();
  return (await getSectionDocs()) as unknown as Section[];
}

export async function fetchEdition(): Promise<Edition> {
  await connect();
  await io();
  const now = new Date();
  const [stories, [market], weather] = await Promise.all([
    collections.articles.countDocuments(PUBLISHED()),
    getMarketDocs(),
    getWeather(),
  ]);
  return {
    name: editionName(now.getHours()),
    date: dateFormat.format(now),
    updated: timeFormat.format(now),
    stories,
    weather,
    market: (market ? { name: market.name, change: market.change } : null) as Edition["market"],
  };
}

export async function fetchTicker(): Promise<TickerItem[]> {
  await connect();
  await io();
  const items = await collections.articles
    .find(
      { $and: [PUBLISHED(), { $or: [{ tickerOrder: { $exists: true } }, { breaking: true }] }] },
      { projection: { slug: 1, title: 1, publishedAt: 1, tickerOrder: 1, breaking: 1 } },
    )
    .toArray();
  // Breaking stories pin to the front, newest first; curated items keep their set order.
  items.sort((a, b) =>
    Number(Boolean(b.breaking)) - Number(Boolean(a.breaking)) ||
    (a.breaking ? b.publishedAt.getTime() - a.publishedAt.getTime() : (a.tickerOrder ?? 0) - (b.tickerOrder ?? 0)),
  );
  return items.map((a) => ({ slug: a.slug, title: a.title, time: timeFormat.format(a.publishedAt) }));
}

export async function fetchHome(): Promise<HomeData> {
  await connect();
  await io();
  const [sections, newest, markets] = await Promise.all([
    getSectionDocs(),
    collections.articles.find(PUBLISHED(), LIST).sort({ publishedAt: -1 }).toArray(),
    getMarketDocs(),
  ]);
  const names = new Map(sections.map((s) => [s.slug, s.name]));
  const used = new Set<StoredArticle>();
  // Takes the newest unused stories from a pool so nothing appears twice on the page.
  const take = (pool: StoredArticle[], count: number) => {
    const picked = pool.filter((a) => !used.has(a)).slice(0, count);
    picked.forEach((a) => used.add(a));
    return picked.map((a) => present(a, names));
  };
  const docs = newest as unknown as StoredArticle[];
  const inSection = (slug: string) => docs.filter((a) => a.section === slug);
  const deskSections = sections.filter((s) => DESKS.includes(s.slug));

  const [lead] = take(inSection("world"), 1);
  const briefs = take(inSection("world"), 4);
  const opinion = take(inSection("opinion"), 4);
  const pictures = take(inSection("in-pictures"), 5);
  const top = [
    ...take(inSection("longform"), 2),
    ...take(
      docs.filter((a) => a.section !== "world"),
      1,
    ),
  ];
  const across = deskSections
    .filter((s) => s.slug !== "world")
    .flatMap((s) => take(inSection(s.slug), 1));
  const desks = deskSections
    .map((section) => {
      const [feature, ...list] = take(inSection(section.slug), 3);
      return { section: section as unknown as Section, feature, list };
    })
    .filter((desk) => desk.feature);
  const mostRead = [...docs]
    .sort((a, b) => b.reads - a.reads)
    .slice(0, 5)
    .map((a) => present(a, names));

  return { lead, briefs, top, across, desks, mostRead, markets: markets as unknown as Market[], opinion, pictures };
}

export async function fetchArticles(params: {
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; articles: Article[] }> {
  await connect();
  await io();
  const limit = Math.min(params.limit || 20, 50);
  const offset = Math.max(params.offset || 0, 0);

  const filter: Record<string, unknown> = { ...PUBLISHED() };
  if (params.section) filter.section = String(params.section);
  const terms = params.q ? String(params.q).split(/\s+/).filter(Boolean) : [];
  // Every term must appear somewhere in the story, matching the old substring search.
  if (terms.length) {
    filter.$and = terms.map((term) => ({
      $or: SEARCH_FIELDS.map((field) => ({ [field]: { $regex: escapeRegex(term), $options: "i" } })),
    }));
  }

  const [names, total, found] = await Promise.all([
    sectionNames(),
    collections.articles.countDocuments(filter),
    collections.articles.find(filter, LIST).sort({ publishedAt: -1 }).skip(offset).limit(limit).toArray(),
  ]);
  return { total, articles: (found as unknown as StoredArticle[]).map((a) => present(a, names)) };
}

// Fetches articles for an explicit slug list (saved stories, reading history),
// preserving the input order. Missing slugs are dropped silently.
export async function fetchArticlesBySlugs(slugs: string[]): Promise<Article[]> {
  await io();
  if (!slugs.length) return [];
  await connect();
  const [names, docs] = await Promise.all([
    sectionNames(),
    collections.articles.find({ slug: { $in: slugs } }, LIST).toArray(),
  ]);
  const bySlug = new Map((docs as unknown as StoredArticle[]).map((a) => [a.slug, a]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((a): a is StoredArticle => Boolean(a))
    .map((a) => present(a, names));
}

export async function fetchArticle(
  slug: string,
): Promise<{ article: Article; related: Article[] } | null> {
  await connect();
  await io();
  const found = (await collections.articles.findOne({ slug })) as unknown as StoredArticle | null;
  if (!found) return null;

  // Hand-picked related stories win; otherwise take the newest from the same desk.
  const relatedQuery = found.related?.length
    ? { slug: { $in: found.related } }
    : { ...PUBLISHED(), section: found.section, slug: { $ne: found.slug } };
  const [names, relatedDocs] = await Promise.all([
    sectionNames(),
    collections.articles
      .find(relatedQuery, LIST)
      .sort({ publishedAt: -1 })
      .limit(3)
      .toArray(),
  ]);
  const related = relatedDocs as unknown as StoredArticle[];
  if (found.related?.length) {
    const order = new Map(found.related.map((s, i) => [s, i]));
    related.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  }
  return {
    article: present(found, names, { full: true }),
    related: related.map((a) => present(a, names)),
  };
}

export async function searchArticles(
  q: string,
): Promise<{ slug: string; title: string; sectionName: string }[]> {
  await connect();
  await io();
  const filter: Record<string, unknown> = { ...PUBLISHED() };
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length) {
    filter.$and = terms.map((term) => ({
      $or: ["title", "dek"].map((field) => ({ [field]: { $regex: escapeRegex(term), $options: "i" } })),
    }));
  }
  const [names, found] = await Promise.all([
    sectionNames(),
    collections.articles
      .find(filter, { projection: { slug: 1, title: 1, section: 1 } })
      .sort({ publishedAt: -1 })
      .limit(8)
      .toArray(),
  ]);
  return found.map((a) => ({
    slug: a.slug,
    title: a.title,
    sectionName: names.get(a.section) ?? a.section,
  }));
}

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ");
// A block with no text still matters when it carries media (image, video, table, rule).
const hasMedia = (html: string) =>
  /<(img|iframe|table|hr|video|audio|embed|object)[\s>]/i.test(html);

export type ArticleInput = {
  title: string;
  slug?: string;
  section: string;
  dek: string;
  author: string;
  city: string;
  lead: string;
  body: string[];
  tags?: string[];
  sources?: { label: string; url: string }[];
  related?: string[];
  seo?: { title?: string; description?: string };
  breaking?: boolean;
  publishAt?: string | null;
  image?: { data: string } | null;
};

export async function insertArticle(
  input: ArticleInput,
): Promise<{ slug: string; scheduled: boolean } | { error: string }> {
  await connect();
  const title = String(input.title ?? "").trim();
  const section = String(input.section ?? "").trim();
  const dek = String(input.dek ?? "").trim();
  const author = String(input.author ?? "").trim();
  const city = String(input.city ?? "").trim();
  const lead = String(input.lead ?? "").trim();
  const body = (Array.isArray(input.body) ? input.body : [])
    .map((block) => String(block).trim())
    .filter((block) => stripHtml(block).replace(/&nbsp;/g, " ").trim() || hasMedia(block));

  if (title.length < 10 || title.length > 200) {
    return { error: "Give the story a headline between 10 and 200 characters." };
  }
  const desk = await collections.sections.findOne({ slug: section }, { projection: { _id: 1 } });
  if (!desk) {
    return { error: "Choose a desk for the story." };
  }
  if (dek.length < 10 || dek.length > 300) {
    return { error: "Write a standfirst between 10 and 300 characters." };
  }
  if (!author || author.length > 80) {
    return { error: "Add a byline." };
  }
  if (!city || city.length > 80) {
    return { error: "Add a dateline city." };
  }
  if (lead.length < 30) {
    return { error: "The lead needs at least 30 characters." };
  }
  if (!body.length) {
    return { error: "Write at least one body block after the lead." };
  }

  const tags = (input.tags ?? [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 8);
  const sources = (input.sources ?? [])
    .map((source) => ({ label: String(source?.label ?? "").trim(), url: String(source?.url ?? "").trim() }))
    .filter((source) => source.label && /^https?:\/\//i.test(source.url))
    .slice(0, 8);
  const related = (input.related ?? []).map((slug) => String(slug)).filter(Boolean).slice(0, 3);
  const seo = {
    ...(input.seo?.title?.trim() ? { title: input.seo.title.trim() } : {}),
    ...(input.seo?.description?.trim() ? { description: input.seo.description.trim() } : {}),
  };
  // Featured images go to Cloudinary; the article stores the hosted URL.
  let image: string | undefined;
  if (input.image?.data && /^data:image\//.test(input.image.data)) {
    if (input.image.data.length > 12_000_000) {
      return { error: "The featured image is too large — use one under ~9 MB." };
    }
    const uploaded = await uploadImage(input.image.data, "gmi/articles");
    if (!uploaded) return { error: "The featured image couldn't be uploaded. Try again." };
    image = uploaded;
  }

  const publishDate = input.publishAt ? new Date(input.publishAt) : new Date();
  const publishedAt = Number.isNaN(publishDate.getTime()) ? new Date() : publishDate;

  // Headlines often repeat, so the slug gets a numeric suffix until it is free.
  const base = slugify(input.slug?.trim() || title) || "story";
  let slug = base;
  for (let n = 2; await collections.articles.findOne({ slug }, { projection: { _id: 1 } }); n += 1) {
    slug = `${base}-${n}`;
  }

  const words = (stripHtml(body.join(" ")) + " " + lead).split(/\s+/).filter(Boolean).length;
  await collections.articles.insertOne({
    slug,
    section,
    title,
    dek,
    author,
    city,
    lead,
    body,
    tags,
    sources,
    related,
    seo,
    breaking: Boolean(input.breaking),
    ...(image ? { image } : {}),
    reads: 0,
    readMinutes: Math.max(1, Math.round(words / 60)),
    publishedAt,
  });
  return { slug, scheduled: publishedAt.getTime() > Date.now() };
}

export async function insertSubscriber(emailField: unknown): Promise<{ ok: true } | { error: string }> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    await collections.subscribers.updateOne(
      { email },
      { $setOnInsert: { email, subscribedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    // Two simultaneous sign-ups for one address: the other request already saved it.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  return { ok: true };
}
