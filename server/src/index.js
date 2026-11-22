import cors from "cors";
import express from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collections, connect, db } from "./db.js";
import { seed } from "./seed.js";

const PORT = process.env.PORT || 4000;
// Base the frontend uses for this API; needed to turn stored image paths into absolute URLs.
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads");
const HOUR = 60 * 60 * 1000;
const DESKS = ["world", "business", "technology", "culture", "science"];
const SEARCH_FIELDS = ["title", "dek", "author", "city", "body"];
// List views never show the story text, so it is left out of those queries.
const LIST = { projection: { body: 0 } };
const HIDDEN = { projection: { _id: 0, order: 0 } };

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ROLES = {
  world: "Foreign correspondent",
  business: "Business reporter",
  technology: "Technology reporter",
  culture: "Culture writer",
  science: "Science correspondent",
  opinion: "Columnist",
  "in-pictures": "Staff photographer",
  longform: "Senior writer",
};

const getSections = () => collections.sections.find({}, HIDDEN).sort({ order: 1 }).toArray();
const getMarkets = () => collections.markets.find({}, HIDDEN).sort({ order: 1 }).toArray();
const sectionNames = async () => new Map((await getSections()).map((s) => [s.slug, s.name]));

// Extra fields only the article page needs.
function details(article, sectionName) {
  const role = ROLES[article.section];
  return {
    authorRole: role,
    authorBio: `${article.author} is a ${role.toLowerCase()} at Good Morning Indian, based in ${article.city}. Their reporting appears on the ${sectionName} desk.`,
    caption: `${article.city}. Photograph: Good Morning Indian`,
    tags: article.tags?.length ? article.tags : [sectionName, article.city],
    sources: article.sources ?? [],
    ...(article.body.length >= 4
      ? {
          inlineImage: `https://picsum.photos/seed/${article.slug}-inline/1200/675`,
          inlineCaption: `On the ground in ${article.city}. Photograph: Good Morning Indian`,
        }
      : {}),
  };
}

function timeAgo(date) {
  const hours = Math.floor((Date.now() - date) / HOUR);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function present(article, names, { full = false } = {}) {
  const { _id, body, tickerOrder, publishedAt, revisions, related, seo, tags, sources, ...rest } =
    article;
  const sectionName = names.get(article.section);
  // Uploaded covers are stored as local paths; pasted URLs are kept as-is.
  const image = !article.image
    ? `https://picsum.photos/seed/${article.slug}/1200/800`
    : article.image.startsWith("/")
      ? `${PUBLIC_URL}${article.image}`
      : article.image;
  return {
    ...rest,
    sectionName,
    image,
    publishedAt: publishedAt.toISOString(),
    publishedTime: timeFormat.format(publishedAt),
    ago: timeAgo(publishedAt),
    ...(full ? { body, seo: seo ?? null, ...details(article, sectionName) } : {}),
  };
}

// Scheduled stories stay hidden from public listings until their publish time.
const visible = () => ({ publishedAt: { $lte: new Date() } });

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const WEATHER_LOCATION = process.env.WEATHER_LOCATION || "Bengaluru";
const WEATHER_TTL = 10 * 60 * 1000;
let weatherCache = { at: 0, data: null };

async function getWeather() {
  if (weatherCache.data && Date.now() - weatherCache.at < WEATHER_TTL) return weatherCache.data;
  if (!process.env.WEATHER_API_KEY) return null;

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.search = new URLSearchParams({
    key: process.env.WEATHER_API_KEY,
    q: WEATHER_LOCATION,
    days: "3",
    aqi: "no",
    alerts: "yes",
  });

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`WeatherAPI responded ${response.status}`);
    const { location, current, forecast, alerts } = await response.json();
    const data = {
      city: location.name,
      temperature: `${Math.round(current.temp_c)}°C`,
      summary: `${current.condition.text}, wind ${current.wind_dir} ${Math.round(current.wind_kph)} km/h`,
      forecast: forecast.forecastday.map(({ date, day }) => ({
        date,
        high: Math.round(day.maxtemp_c),
        low: Math.round(day.mintemp_c),
        condition: day.condition.text,
        chanceOfRain: day.daily_chance_of_rain,
      })),
      alerts: (alerts?.alert ?? []).map((a) => ({ headline: a.headline, severity: a.severity })),
    };
    weatherCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error("Weather fetch failed:", error.message);
    return weatherCache.data;
  }
}

function editionName(hour) {
  if (hour < 12) return "Morning Edition";
  if (hour < 17) return "Afternoon Edition";
  return "Evening Edition";
}

const app = express();
app.use(cors());
// Featured images arrive as base64 data URLs, so the JSON limit is generous.
app.use(express.json({ limit: "12mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", async (req, res) => {
  await db.command({ ping: 1 });
  res.json({ ok: true });
});

app.get("/api/sections", async (req, res) => res.json(await getSections()));

app.get("/api/edition", async (req, res) => {
  const now = new Date();
  const [stories, [market], weather] = await Promise.all([
    collections.articles.countDocuments(),
    getMarkets(),
    getWeather(),
  ]);
  res.json({
    name: editionName(now.getHours()),
    date: dateFormat.format(now),
    updated: timeFormat.format(now),
    stories,
    weather,
    market: market ? { name: market.name, change: market.change } : null,
  });
});

app.get("/api/ticker", async (req, res) => {
  const items = await collections.articles
    .find(
      { tickerOrder: { $exists: true }, ...visible() },
      { projection: { slug: 1, title: 1, publishedAt: 1 } },
    )
    .sort({ tickerOrder: 1 })
    .toArray();
  res.json(items.map((a) => ({ slug: a.slug, title: a.title, time: timeFormat.format(a.publishedAt) })));
});

app.get("/api/home", async (req, res) => {
  const [sections, newest, markets] = await Promise.all([
    getSections(),
    collections.articles.find(visible(), LIST).sort({ publishedAt: -1 }).toArray(),
    getMarkets(),
  ]);
  const names = new Map(sections.map((s) => [s.slug, s.name]));
  const used = new Set();
  // Takes the newest unused stories from a pool so nothing appears twice on the page.
  const take = (pool, count) => {
    const picked = pool.filter((a) => !used.has(a)).slice(0, count);
    picked.forEach((a) => used.add(a));
    return picked.map((a) => present(a, names));
  };
  const inSection = (slug) => newest.filter((a) => a.section === slug);
  const deskSections = sections.filter((s) => DESKS.includes(s.slug));

  const [lead] = take(inSection("world"), 1);
  const briefs = take(inSection("world"), 4);
  const opinion = take(inSection("opinion"), 4);
  const pictures = take(inSection("in-pictures"), 5);
  const top = [
    ...take(inSection("longform"), 2),
    ...take(
      newest.filter((a) => a.section !== "world"),
      1,
    ),
  ];
  const across = deskSections
    .filter((s) => s.slug !== "world")
    .flatMap((s) => take(inSection(s.slug), 1));
  const desks = deskSections
    .map((section) => {
      const [feature, ...list] = take(inSection(section.slug), 3);
      return { section, feature, list };
    })
    .filter((desk) => desk.feature);
  const mostRead = [...newest]
    .sort((a, b) => b.reads - a.reads)
    .slice(0, 5)
    .map((a) => present(a, names));

  res.json({ lead, briefs, top, across, desks, mostRead, markets, opinion, pictures });
});

app.get("/api/articles", async (req, res) => {
  const { section, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const filter = visible();
  if (section) filter.section = String(section);
  const terms = q ? String(q).split(/\s+/).filter(Boolean) : [];
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
  res.json({ total, articles: found.map((a) => present(a, names)) });
});

app.get("/api/articles/:slug", async (req, res) => {
  const found = await collections.articles.findOne({ slug: req.params.slug });
  if (!found) return res.status(404).json({ error: "Article not found" });

  // Hand-picked related stories win over the automatic same-desk picks.
  const relatedDocs = found.related?.length
    ? await collections.articles.find({ slug: { $in: found.related }, ...visible() }, LIST).toArray()
    : await collections.articles
        .find({ section: found.section, slug: { $ne: found.slug }, ...visible() }, LIST)
        .sort({ publishedAt: -1 })
        .limit(3)
        .toArray();
  const related = found.related?.length
    ? found.related.map((slug) => relatedDocs.find((doc) => doc.slug === slug)).filter(Boolean)
    : relatedDocs;

  const names = await sectionNames();
  res.json({
    article: present(found, names, { full: true }),
    related: related.map((a) => present(a, names)),
  });
});

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const escapeText = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const stripHtml = (html) => html.replace(/<[^>]*>/g, " ");

// Tags the rich-text editor is allowed to produce; everything else is stripped.
const SAFE_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "a",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "br",
  "p",
]);

function sanitizeBlock(html) {
  return html
    .replace(
      /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(/<(\/?)([a-zA-Z0-9]+)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g, (match, close, tag, attrs) => {
      const name = tag.toLowerCase();
      if (!SAFE_TAGS.has(name)) return "";
      if (close) return `</${name}>`;
      if (name === "a") {
        const href =
          attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? attrs.match(/href\s*=\s*'([^']*)'/i)?.[1] ?? "";
        return /^https?:\/\//i.test(href)
          ? `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener">`
          : "<a>";
      }
      return `<${name}>`;
    });
}

const IMAGE_TYPES = { png: "png", jpeg: "jpg", jpg: "jpg", webp: "webp", gif: "gif" };

async function saveImage(dataUrl, slug) {
  const match = String(dataUrl).match(/^data:image\/([a-z]+);base64,(.+)$/is);
  if (!match) return null;
  const ext = IMAGE_TYPES[match[1].toLowerCase()];
  if (!ext) return null;
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) return null;
  await mkdir(UPLOADS_DIR, { recursive: true });
  const name = `${slug}-${Date.now()}.${ext}`;
  await writeFile(path.join(UPLOADS_DIR, name), buffer);
  return `/uploads/${name}`;
}

const str = (value, max = Infinity) => String(value ?? "").trim().slice(0, max);

app.post("/api/articles", async (req, res) => {
  const input = req.body ?? {};
  const field = (name, max) => str(input[name], max);
  const title = field("title", 200);
  const section = field("section");
  const dek = field("dek", 300);
  const author = field("author", 80);
  const city = field("city", 80);
  const lead = field("lead", 600);
  // The editor sends top-level HTML blocks; the lead is prepended as a plain paragraph.
  const blocks = (Array.isArray(input.body) ? input.body : [])
    .slice(0, 60)
    .map((block) => sanitizeBlock(str(block, 20000)))
    .filter((block) => stripHtml(block).trim());

  if (title.length < 10) {
    return res.status(400).json({ error: "Give the story a headline between 10 and 200 characters." });
  }
  const desk = await collections.sections.findOne({ slug: section }, { projection: { _id: 1 } });
  if (!desk) {
    return res.status(400).json({ error: "Choose a desk for the story." });
  }
  if (dek.length < 10) {
    return res.status(400).json({ error: "Write a standfirst between 10 and 300 characters." });
  }
  if (!author) {
    return res.status(400).json({ error: "Add a byline." });
  }
  if (!city) {
    return res.status(400).json({ error: "Add a dateline city." });
  }
  if (lead.length < 30) {
    return res.status(400).json({
      error:
        "Write a lead paragraph of 30 to 600 characters answering who, what, where, when, why and how.",
    });
  }
  if (!blocks.length) {
    return res.status(400).json({ error: "Add at least one body block after the lead." });
  }

  // A custom slug is honoured but still normalized and de-duplicated.
  const base = slugify(str(input.slug, 200)) || slugify(title) || "story";
  let slug = base;
  for (let n = 2; await collections.articles.findOne({ slug }, { projection: { _id: 1 } }); n += 1) {
    slug = `${base}-${n}`;
  }

  const tags = (Array.isArray(input.tags) ? input.tags : [])
    .map((tag) => str(tag, 40))
    .filter(Boolean)
    .slice(0, 8);

  const sources = (Array.isArray(input.sources) ? input.sources : [])
    .map((source) => ({ label: str(source?.label, 120), url: str(source?.url, 500) }))
    .filter((source) => source.label && /^https?:\/\//i.test(source.url))
    .slice(0, 8);

  const picked = (Array.isArray(input.related) ? input.related : []).map((s) => str(s, 200));
  const related = picked.length
    ? (
        await collections.articles
          .find({ slug: { $in: picked } }, { projection: { slug: 1 } })
          .toArray()
      )
        .map((doc) => doc.slug)
        .filter((s) => s !== slug)
        .slice(0, 3)
    : [];

  const seoInput = input.seo ?? {};
  const seo = {
    ...(str(seoInput.title, 70) ? { title: str(seoInput.title, 70) } : {}),
    ...(str(seoInput.description, 160) ? { description: str(seoInput.description, 160) } : {}),
  };

  // A future date schedules the story; anything else publishes immediately.
  const requested = new Date(input.publishAt);
  const publishedAt =
    !Number.isNaN(requested.getTime()) && requested > new Date() ? requested : new Date();
  const status = publishedAt > new Date() ? "scheduled" : "published";

  const image =
    typeof input.image === "string" && /^https?:\/\//i.test(input.image)
      ? str(input.image, 1000)
      : await saveImage(input.image?.data, slug);

  // Breaking stories lead the live ticker, ahead of previously flagged items.
  let tickerOrder;
  if (input.breaking) {
    const [first] = await collections.articles
      .find({ tickerOrder: { $exists: true } }, { projection: { tickerOrder: 1 } })
      .sort({ tickerOrder: 1 })
      .limit(1)
      .toArray();
    tickerOrder = (first?.tickerOrder ?? 1) - 1;
  }

  const words = stripHtml(blocks.join(" ")).split(/\s+/).filter(Boolean).length;
  const body = [`<p>${escapeText(lead)}</p>`, ...blocks];
  await collections.articles.insertOne({
    slug,
    section,
    title,
    dek,
    author,
    city,
    tags,
    sources,
    related,
    seo,
    image,
    status,
    breaking: Boolean(input.breaking),
    reads: 0,
    readMinutes: Math.max(1, Math.round(words / 60)),
    body,
    publishedAt,
    revisions: [{ savedAt: new Date(), title, dek, lead, body, section, tags, author, city }],
    ...(tickerOrder !== undefined ? { tickerOrder } : {}),
  });
  res.status(201).json({ slug, status });
});

app.post("/api/subscribe", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    await collections.subscribers.updateOne(
      { email },
      { $setOnInsert: { email, subscribedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    // Two simultaneous sign-ups for one address: the other request already saved it.
    if (error.code !== 11000) throw error;
  }
  res.status(201).json({ ok: true });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

await connect();
if ((await collections.articles.estimatedDocumentCount()) === 0) {
  const counts = await seed();
  console.log(`Empty database: seeded ${counts.articles} sample articles.`);
}

app.listen(PORT, () => {
  console.log(`News API listening on http://localhost:${PORT}`);
});
