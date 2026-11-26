import { io } from "next/cache";
import type { Article, Edition, EditableArticle, HomeData, Market, MarketDetail, MarketView, Section, TickerItem, Weather } from "./api";
import { ADULT_WORDS_MESSAGE, hasAdultWords } from "./censor";
import { isHostedImage, uploadImage } from "./cloudinary";
import { collections, connect } from "./db";
import { COMMODITIES, MARKET_RANGES, MARKET_SYMBOLS, marketSlug, type MarketRange } from "./markets";
import { EMAIL_FORMATS, NEWSLETTERS } from "./newsletters";

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
  updatedAt?: Date;
  tickerOrder?: number;
  authorId?: string;
  views?: number;
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

type Point = { t: number; c: number };

const formatPrice = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Daily closes over `range`. The change is the last close against the one before it,
// falling back to the previous close Yahoo reports when only one bar is returned.
async function chart(symbol: string, range: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const result = (await res.json()).chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice || !meta.chartPreviousClose) return null;
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const points: Point[] = (result.timestamp ?? []).flatMap((t: number, i: number) =>
      typeof closes[i] === "number" ? [{ t: t * 1000, c: closes[i] as number }] : [],
    );
    const previous = points.at(-2)?.c ?? meta.chartPreviousClose;
    const price = meta.regularMarketPrice as number;
    return {
      price,
      change: ((price - previous) / previous) * 100,
      currency: (meta.currency as string | undefined) ?? "",
      points,
    };
  } catch {
    return null;
  }
}

async function withLiveQuotes(markets: Market[]): Promise<Market[]> {
  return Promise.all(
    markets.map(async (market) => {
      const symbol = MARKET_SYMBOLS[market.name];
      const quote = symbol ? await chart(symbol, "1d") : null;
      return quote ? { ...market, value: formatPrice(quote.price), change: quote.change } : market;
    }),
  );
}

export async function fetchMarketViews(): Promise<MarketView[]> {
  await connect();
  await io();
  const docs = (await getMarketDocs()) as unknown as Market[];
  return Promise.all(
    docs.map(async (market) => {
      const symbol = MARKET_SYMBOLS[market.name];
      const quote = symbol ? await chart(symbol, "3mo") : null;
      return {
        ...market,
        ...(quote ? { value: formatPrice(quote.price), change: quote.change } : {}),
        slug: marketSlug(market.name),
        commodity: COMMODITIES.has(market.name),
        currency: quote?.currency ?? "",
        points: quote?.points ?? [],
      };
    }),
  );
}

async function history(symbol: string, range: string, interval: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const result = (await res.json()).chart?.result?.[0];
    const meta = result?.meta;
    if (!meta?.regularMarketPrice || !meta.chartPreviousClose) return null;
    const quote = result.indicators?.quote?.[0] ?? {};
    const points: MarketDetail["points"] = (result.timestamp ?? []).flatMap((t: number, i: number) =>
      typeof quote.close?.[i] === "number"
        ? [{ t: t * 1000, c: quote.close[i] as number, v: typeof quote.volume?.[i] === "number" ? (quote.volume[i] as number) : null }]
        : [],
    );
    return { meta, points };
  } catch {
    return null;
  }
}

export async function fetchMarketDetail(slug: string, range: MarketRange): Promise<MarketDetail | null> {
  await connect();
  await io();
  const doc = ((await getMarketDocs()) as unknown as Market[]).find((m) => marketSlug(m.name) === slug);
  const symbol = doc && MARKET_SYMBOLS[doc.name];
  if (!doc || !symbol) return null;
  const { range: span, interval } = MARKET_RANGES[range];
  const [today, series, fx] = await Promise.all([
    history(symbol, "1d", "5m"),
    history(symbol, span, interval),
    COMMODITIES.has(doc.name) ? history("INR=X", "1d", "5m") : null,
  ]);
  if (!today || !series) return null;
  const { meta } = today;
  const price = meta.regularMarketPrice as number;
  const previous = meta.chartPreviousClose as number;
  const num = (n: unknown) => (typeof n === "number" ? n : null);
  return {
    name: doc.name,
    slug,
    symbol,
    commodity: COMMODITIES.has(doc.name),
    currency: (meta.currency as string | undefined) ?? "",
    price,
    delta: price - previous,
    change: ((price - previous) / previous) * 100,
    previousClose: previous,
    open: num(meta.regularMarketOpen),
    high: num(meta.regularMarketDayHigh),
    low: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    week52High: num(meta.fiftyTwoWeekHigh),
    week52Low: num(meta.fiftyTwoWeekLow),
    updated: num(meta.regularMarketTime) ? (meta.regularMarketTime as number) * 1000 : Date.now(),
    range,
    points: series.points,
    inrRate: fx ? num(fx.meta.regularMarketPrice) : null,
  };
}

const sectionNames = async () => new Map((await getSectionDocs()).map((s) => [s.slug, s.name]));

// Extra fields only the article page needs.
function details(article: StoredArticle, sectionName: string) {
  const role = ROLES[article.section] ?? "Staff writer";
  return {
    authorRole: role,
    authorBio: `${article.author} is a ${role.toLowerCase()} at Good Morning Indian, based in ${article.city}. Their reporting appears on the ${sectionName} desk.`,
    caption: `${article.city}. Photograph: Good Morning Indian`,
    tags: article.tags?.length ? article.tags : [sectionName, article.city],
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
  raw: StoredArticle,
  names: Map<string, string>,
  { full = false } = {},
): Article {
  const article = raw;
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
          // Only set by edits — fresh stories have nothing "updated" to show.
          ...(article.updatedAt
            ? {
                updatedAt: article.updatedAt.toISOString(),
                updatedTime: timeFormat.format(article.updatedAt),
              }
            : {}),
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
  // The header chip shows the first market (Nifty 50) with a live quote —
  // same 5-minute-cached Yahoo call the markets strip uses, seeded figures
  // as fallback when Yahoo can't be reached.
  const symbol = market && MARKET_SYMBOLS[market.name];
  const quote = symbol ? await chart(symbol, "1d") : null;
  return {
    name: editionName(now.getHours()),
    date: dateFormat.format(now),
    updated: timeFormat.format(now),
    stories,
    weather,
    market: (market
      ? {
          name: market.name,
          change: quote ? Number(quote.change.toFixed(2)) : market.change,
          value: quote ? formatPrice(quote.price) : market.value,
        }
      : null) as Edition["market"],
  };
}

export async function fetchMarkets(): Promise<Market[]> {
  await connect();
  await io();
  return withLiveQuotes((await getMarketDocs()) as unknown as Market[]);
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

  return { lead, briefs, top, across, desks, mostRead, markets: await withLiveQuotes(markets as unknown as Market[]), opinion, pictures };
}

export async function fetchArticles(params: {
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
  olderThanDays?: number;
  newerThanDays?: number;
}): Promise<{ total: number; articles: Article[] }> {
  await connect();
  await io();
  const limit = Math.min(params.limit || 20, 50);
  const offset = Math.max(params.offset || 0, 0);

  const filter: Record<string, unknown> = { ...PUBLISHED() };
  if (params.section) filter.section = String(params.section);
  const window: Record<string, Date> = { ...PUBLISHED().publishedAt };
  if (params.olderThanDays && params.olderThanDays > 0) window.$lte = new Date(Date.now() - params.olderThanDays * 24 * HOUR);
  if (params.newerThanDays) window.$gt = new Date(Date.now() - params.newerThanDays * 24 * HOUR);
  filter.publishedAt = window;
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
  viewerId?: string,
): Promise<{
  article: Article;
  related: Article[];
  ownerId: string | null;
  stats: { views: number; readers: number; saved: number } | null;
} | null> {
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
  // Engagement stats are only computed for the story's author; other viewers
  // never receive them in the page payload.
  let stats: { views: number; readers: number; saved: number } | null = null;
  if (viewerId && found.authorId === viewerId) {
    const [readers, saved] = await Promise.all([
      collections.reads.countDocuments({ slug }),
      collections.bookmarks.countDocuments({ slug }),
    ]);
    stats = { views: found.views ?? 0, readers, saved };
  }
  return {
    article: present(found, names, { full: true }),
    related: related.map((a) => present(a, names)),
    ownerId: found.authorId ?? null,
    stats,
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

type ArticleFields = {
  title: string;
  section: string;
  dek: string;
  author: string;
  city: string;
  lead: string;
  body: string[];
  tags: string[];
  sources: { label: string; url: string }[];
  related: string[];
  seo: { title?: string; description?: string };
  breaking: boolean;
  readMinutes: number;
  publishedAt?: Date;
  // undefined keeps the stored image, null removes it, a string is the hosted URL.
  image?: string | null;
};

// Validates and normalizes a story submission shared by create and edit.
async function prepareArticle(input: ArticleInput): Promise<{ error: string } | { fields: ArticleFields }> {
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
  if (hasAdultWords([title, dek, lead, ...body, ...tags, seo.title ?? "", seo.description ?? ""].join(" "))) {
    return { error: ADULT_WORDS_MESSAGE };
  }

  // Featured images go to Cloudinary; the article stores the hosted URL.
  let image: string | null | undefined;
  if (input.image === null) {
    image = null;
  } else if (input.image?.data && isHostedImage(input.image.data, "gmi/articles")) {
    image = input.image.data;
  } else if (input.image?.data && /^data:image\//.test(input.image.data)) {
    if (input.image.data.length > 12_000_000) {
      return { error: "The featured image is too large — use one under ~9 MB." };
    }
    const uploaded = await uploadImage(input.image.data, "gmi/articles");
    if (!uploaded) return { error: "The featured image couldn't be uploaded. Try again." };
    image = uploaded;
  }

  const publishDate = input.publishAt ? new Date(input.publishAt) : null;
  const publishedAt = publishDate && !Number.isNaN(publishDate.getTime()) ? publishDate : undefined;
  const words = (stripHtml(body.join(" ")) + " " + lead).split(/\s+/).filter(Boolean).length;
  return {
    fields: {
      title,
      section,
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
      readMinutes: Math.max(1, Math.round(words / 60)),
      publishedAt,
      image,
    },
  };
}

export async function insertArticle(
  input: ArticleInput,
  authorId: string,
): Promise<{ slug: string; scheduled: boolean } | { error: string }> {
  await connect();
  const prepared = await prepareArticle(input);
  if ("error" in prepared) return prepared;
  const { image, ...fields } = prepared.fields;
  const publishedAt = fields.publishedAt ?? new Date();

  // Headlines often repeat, so the slug gets a numeric suffix until it is free.
  const base = slugify(input.slug?.trim() || fields.title) || "story";
  let slug = base;
  for (let n = 2; await collections.articles.findOne({ slug }, { projection: { _id: 1 } }); n += 1) {
    slug = `${base}-${n}`;
  }

  await collections.articles.insertOne({
    ...fields,
    slug,
    authorId,
    publishedAt,
    reads: 0,
    ...(image ? { image } : {}),
  });
  return { slug, scheduled: publishedAt.getTime() > Date.now() };
}

// Only the author can change a story. The slug stays fixed, and the publish date and
// image are kept unless the submission changes them.
export async function updateArticle(
  slug: string,
  input: ArticleInput,
  userId: string,
): Promise<{ slug: string } | { error: string }> {
  await connect();
  const existing = await collections.articles.findOne({ slug }, { projection: { authorId: 1 } });
  if (existing?.authorId !== userId) return { error: "You can only edit your own stories." };
  const prepared = await prepareArticle(input);
  if ("error" in prepared) return prepared;
  const { image, publishedAt, ...fields } = prepared.fields;
  await collections.articles.updateOne(
    { slug, authorId: userId },
    {
      $set: {
        ...fields,
        updatedAt: new Date(),
        ...(publishedAt ? { publishedAt } : {}),
        ...(image ? { image } : {}),
      },
      ...(image === null ? { $unset: { image: "" } } : {}),
    },
  );
  return { slug };
}

export async function deleteArticle(slug: string, userId: string): Promise<{ ok: true } | { error: string }> {
  await connect();
  const result = await collections.articles.deleteOne({ slug, authorId: userId });
  return result.deletedCount ? { ok: true } : { error: "You can only delete your own stories." };
}

export async function fetchEditableArticle(slug: string, userId: string): Promise<EditableArticle | null> {
  await connect();
  await io();
  const doc = (await collections.articles.findOne({ slug, authorId: userId })) as unknown as StoredArticle | null;
  if (!doc) return null;
  const related = await fetchArticlesBySlugs(doc.related ?? []);
  return {
    slug: doc.slug,
    title: doc.title,
    dek: doc.dek,
    lead: doc.lead ?? "",
    body: doc.body,
    section: doc.section,
    author: doc.author,
    city: doc.city,
    tags: doc.tags ?? [],
    sources: doc.sources ?? [],
    related: related.map(({ slug, title, sectionName }) => ({ slug, title, sectionName })),
    seo: doc.seo ?? {},
    breaking: Boolean(doc.breaking),
    image: doc.image ?? null,
  };
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const newsletterId = (letter: string) =>
  NEWSLETTERS.some((item) => item.id === letter) ? letter : "briefing";

// Records an email on the subscribers list and enrols it in one newsletter.
// `added` tells callers the letter is new — used to send the confirmation
// email only once, not on every repeat click.
export async function insertSubscriber(
  emailField: unknown,
  letter = "briefing",
): Promise<{ ok: true; added: boolean } | { error: string }> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }

  try {
    const result = await collections.subscribers.updateOne(
      { email },
      {
        $addToSet: { letters: newsletterId(letter) },
        $setOnInsert: { email, subscribedAt: new Date() },
      },
      { upsert: true },
    );
    return { ok: true, added: result.upsertedCount > 0 || result.modifiedCount > 0 };
  } catch (error) {
    // Two simultaneous sign-ups for one address: the other request already saved it.
    if ((error as { code?: number }).code !== 11000) throw error;
    return { ok: true, added: false };
  }
}

// The newsletters an address is subscribed to. Missing docs / older docs
// without a letters array simply have none.
export async function fetchSubscriberLetters(emailField: unknown): Promise<string[]> {
  await connect();
  await io();
  const email = String(emailField || "").trim().toLowerCase();
  if (!email) return [];
  const doc = await collections.subscribers.findOne(
    { email },
    { projection: { letters: 1 } },
  );
  return Array.isArray(doc?.letters)
    ? doc.letters.filter((id): id is string => typeof id === "string")
    : [];
}

// Adds or removes one newsletter on the address' subscription. Unsubscribing
// never creates a doc; subscribing upserts so guest sign-ups work too.
// `added` is true only when a subscribe actually changed the stored list.
export async function setNewsletterSubscription(
  emailField: unknown,
  letter: string,
  on: boolean,
): Promise<{ ok: true; added?: boolean } | { error: string }> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!NEWSLETTERS.some((item) => item.id === letter)) {
    return { error: "Unknown newsletter." };
  }
  const result = await collections.subscribers.updateOne(
    { email },
    on
      ? { $addToSet: { letters: letter }, $setOnInsert: { email, subscribedAt: new Date() } }
      : { $pull: { letters: letter } },
    { upsert: on },
  );
  return { ok: true, added: on && (result.upsertedCount > 0 || result.modifiedCount > 0) };
}

// The email formats an address picked on /newsletters, keyed by newsletter id.
export async function fetchSubscriberFormats(emailField: unknown): Promise<Record<string, string>> {
  await connect();
  await io();
  const email = String(emailField || "").trim().toLowerCase();
  if (!email) return {};
  const doc = await collections.subscribers.findOne(
    { email },
    { projection: { letterFormats: 1 } },
  );
  return Object.fromEntries(
    Object.entries(doc?.letterFormats ?? {}).filter(
      ([id, fmt]) =>
        NEWSLETTERS.some((item) => item.id === id) &&
        EMAIL_FORMATS.some((f) => f.id === fmt),
    ),
  );
}

// Stores one newsletter's email format. Entitlement is checked by the caller
// (server action) against the reader's plan.
export async function setSubscriberFormat(
  emailField: unknown,
  letter: string,
  format: string,
): Promise<{ ok: true } | { error: string }> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!NEWSLETTERS.some((item) => item.id === letter)) {
    return { error: "Unknown newsletter." };
  }
  if (!EMAIL_FORMATS.some((item) => item.id === format)) {
    return { error: "Unknown format." };
  }
  await collections.subscribers.updateOne(
    { email },
    {
      $set: { [`letterFormats.${letter}`]: format },
      $setOnInsert: { email, subscribedAt: new Date() },
    },
    { upsert: true },
  );
  return { ok: true };
}

// Delivery times the address picked per newsletter, keyed by letter id.
export async function fetchSubscriberTimes(emailField: unknown): Promise<Record<string, string>> {
  await connect();
  await io();
  const email = String(emailField || "").trim().toLowerCase();
  if (!email) return {};
  const doc = await collections.subscribers.findOne(
    { email },
    { projection: { letterTimes: 1 } },
  );
  const times = doc?.letterTimes;
  if (!times || typeof times !== "object") return {};
  return Object.fromEntries(
    Object.entries(times).filter(
      ([id, time]) => NEWSLETTERS.some((item) => item.id === id) && typeof time === "string",
    ),
  );
}

// Stores (or clears, with null) one newsletter's delivery time, plus the IANA
// zone that time is expressed in so the delivery cron can evaluate it locally.
export async function setSubscriberLetterTime(
  emailField: unknown,
  letter: string,
  time: string | null,
  timeZone?: string,
): Promise<{ ok: true } | { error: string }> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!NEWSLETTERS.some((item) => item.id === letter)) {
    return { error: "Unknown newsletter." };
  }
  const sets: Record<string, string> = {};
  if (time) sets[`letterTimes.${letter}`] = time;
  if (timeZone) sets.timeZone = timeZone;
  await collections.subscribers.updateOne(
    { email },
    {
      ...(Object.keys(sets).length ? { $set: sets } : {}),
      ...(!time ? { $unset: { [`letterTimes.${letter}`]: "" } } : {}),
      $setOnInsert: { email, subscribedAt: new Date() },
    },
    { upsert: true },
  );
  return { ok: true };
}

// Logs one attempted newsletter email. Called by the email layer after each
// send so the admin dashboard can show whether a reader actually got it.
export async function recordDelivery(
  emailField: unknown,
  letter: string,
  status: "sent" | "skipped" | "failed",
  kind: "confirm" | "issue" = "confirm",
): Promise<void> {
  await connect();
  const email = String(emailField || "").trim().toLowerCase();
  if (!VALID_EMAIL.test(email)) return;
  await collections.deliveries.insertOne({
    email,
    letter,
    kind,
    status,
    sentAt: new Date(),
  });
}

export type AdminLetterStatus = {
  id: string;
  name: string;
  cadence: string;
  time?: string;
  formatName: string;
  // "pending" means no issue was ever recorded for this reader/letter pair;
  // "confirmed" means the subscribe email went out but no issue has yet.
  status: "sent" | "skipped" | "failed" | "confirmed" | "pending";
  sentAt?: string;
};

export type AdminSubscriber = {
  email: string;
  name?: string;
  subscribedAt?: string;
  letters: AdminLetterStatus[];
};

// Every subscriber row for the admin dashboard, joined with the newest
// delivery per letter and the reader's account name when one exists.
export async function fetchSubscriberDashboard(): Promise<AdminSubscriber[]> {
  await connect();
  await io();
  const [subs, deliveries] = await Promise.all([
    collections.subscribers.find({}).sort({ subscribedAt: -1 }).toArray(),
    collections.deliveries
      .find({}, { projection: { email: 1, letter: 1, kind: 1, status: 1, sentAt: 1 } })
      .sort({ sentAt: -1 })
      .toArray(),
  ]);
  const users = await collections.users
    .find({ email: { $in: subs.map((sub) => sub.email) } }, { projection: { email: 1, name: 1 } })
    .toArray();
  const names = new Map(users.map((user) => [user.email, user.name as string | undefined]));

  // Deliveries arrive newest-first, so the first hit per pair+kind is the
  // latest. Issue sends and confirmation sends are tracked separately — a
  // letter only counts as "sent" once an actual issue went out.
  const latest = new Map<string, { status: AdminLetterStatus["status"]; sentAt: Date }>();
  for (const d of deliveries) {
    const key = `${d.email} ${d.letter} ${d.kind}`;
    if (!latest.has(key)) latest.set(key, { status: d.status, sentAt: d.sentAt });
  }

  const letterById = new Map(NEWSLETTERS.map((letter) => [letter.id, letter]));
  return subs.map((sub) => ({
    email: sub.email,
    name: names.get(sub.email),
    subscribedAt: sub.subscribedAt?.toISOString(),
    letters: (Array.isArray(sub.letters) ? sub.letters : [])
      .filter((id): id is string => typeof id === "string")
      .map((id) => {
        const letter = letterById.get(id);
        const key = `${sub.email} ${id}`;
        const issue = latest.get(`${key} issue`);
        const markedDate = sub.letterLastSent?.[id];
        // Issues sent before delivery logging was added only left a
        // letterLastSent date — still counts as sent.
        const status: AdminLetterStatus["status"] = issue
          ? issue.status
          : markedDate
            ? "sent"
            : latest.has(`${key} confirm`)
              ? "confirmed"
              : "pending";
        const fmtId = sub.letterFormats?.[id];
        return {
          id,
          name: letter?.name ?? id,
          cadence: letter?.cadence ?? "",
          ...(sub.letterTimes?.[id] ? { time: sub.letterTimes[id] } : {}),
          formatName: EMAIL_FORMATS.find((item) => item.id === fmtId)?.name ?? EMAIL_FORMATS[0].name,
          status,
          ...(issue
            ? { sentAt: issue.sentAt.toISOString() }
            : markedDate
              ? { sentAt: markedDate }
              : {}),
        };
      }),
  }));
}

export type DeliveryDay = {
  date: string; // "YYYY-MM-DD", UTC
  label: string; // "11/24"
  sent: number;
  failed: number;
  skipped: number;
};

// Per-day newsletter email counts for the admin dashboard. Days with no sends
// still get a row so the chart shows the full window.
export async function fetchDailyDeliveries(days = 14): Promise<DeliveryDay[]> {
  await connect();
  await io();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - (days - 1) * 86_400_000);
  const rows = await collections.deliveries
    .aggregate<{ _id: string; sent: number; failed: number; skipped: number }>([
      { $match: { sentAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$sentAt" } },
          sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          skipped: { $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const byDate = new Map(rows.map((row) => [row._id, row]));
  const out: DeliveryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const row = byDate.get(date);
    out.push({
      date,
      label: `${String(day.getUTCMonth() + 1).padStart(2, "0")}/${String(day.getUTCDate()).padStart(2, "0")}`,
      sent: row?.sent ?? 0,
      failed: row?.failed ?? 0,
      skipped: row?.skipped ?? 0,
    });
  }
  return out;
}

export type DeliveryRow = {
  email: string;
  letter: string;
  kind: "confirm" | "issue";
  status: "sent" | "skipped" | "failed";
  sentAt: string;
};

// Every delivery attempt logged on one UTC date ("YYYY-MM-DD") — the per-day
// drill-down under the "Emails sent" chart on the admin dashboard.
export async function fetchDeliveriesForDay(date: string): Promise<DeliveryRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  await connect();
  await io();
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  const rows = await collections.deliveries
    .find({ sentAt: { $gte: start, $lt: end } })
    .sort({ sentAt: -1 })
    .limit(500)
    .toArray();
  return rows.map((row) => ({
    email: row.email,
    letter: NEWSLETTERS.find((item) => item.id === row.letter)?.name ?? row.letter,
    kind: row.kind,
    status: row.status,
    sentAt: row.sentAt.toISOString(),
  }));
}
