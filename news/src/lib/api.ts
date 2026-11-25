import { connection } from "next/server";
import type { MarketRange } from "./markets";
import {
  fetchArticle,
  fetchArticles,
  fetchEditableArticle,
  fetchEdition,
  fetchHome,
  fetchMarketDetail,
  fetchMarketViews,
  fetchMarkets,
  fetchSections,
  fetchTicker,
} from "./queries";

export type Section = { slug: string; name: string; blurb: string };

export type Article = {
  slug: string;
  section: string;
  sectionName: string;
  title: string;
  dek: string;
  author: string;
  city: string;
  image: string;
  publishedAt: string;
  publishedTime: string;
  updatedAt?: string;
  updatedTime?: string;
  ago: string;
  readMinutes: number;
  reads: number;
  status?: "published" | "scheduled";
  body?: string[];
  breaking?: boolean;
  seo?: { title?: string; description?: string };
  sources?: { label: string; url: string }[];
  authorRole?: string;
  authorBio?: string;
  caption?: string;
  tags?: string[];
};

export type Weather = {
  city: string;
  temperature: string;
  summary: string;
  forecast: { date: string; high: number; low: number; condition: string; chanceOfRain: number }[];
  alerts: { headline: string; severity: string }[];
};

export type Edition = {
  name: string;
  date: string;
  updated: string;
  stories: number;
  weather: Weather | null;
  market: { name: string; change: number };
};

export type TickerItem = { slug: string; title: string; time: string };

export type EditableArticle = {
  slug: string;
  title: string;
  dek: string;
  lead: string;
  body: string[];
  section: string;
  author: string;
  city: string;
  tags: string[];
  sources: { label: string; url: string }[];
  related: { slug: string; title: string; sectionName: string }[];
  seo: { title?: string; description?: string };
  breaking: boolean;
  image: string | null;
};

export type Market = { name: string; value: string; change: number };

export type MarketView = Market & {
  slug: string;
  commodity: boolean;
  currency: string;
  points: { t: number; c: number }[];
};

export type MarketDetail = {
  name: string;
  slug: string;
  symbol: string;
  commodity: boolean;
  currency: string;
  price: number;
  delta: number;
  change: number;
  previousClose: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  updated: number;
  range: MarketRange;
  points: { t: number; c: number; v: number | null }[];
  inrRate: number | null;
};

export type HomeData = {
  lead: Article;
  briefs: Article[];
  top: Article[];
  across: Article[];
  desks: { section: Section; feature: Article; list: Article[] }[];
  mostRead: Article[];
  markets: Market[];
  opinion: Article[];
  pictures: Article[];
};

// Returns null when the database is unreachable or the query fails.
// The real error is logged so Vercel/runtime logs show the actual cause —
// the Offline screen alone makes Mongo failures look like API outages.
async function get<T>(run: () => Promise<T>): Promise<T | null> {
  await connection();
  try {
    return await run();
  } catch (error) {
    console.error("[news] content query failed:", error);
    return null;
  }
}

export const getSections = () => get(fetchSections);
export const getEdition = () => get(fetchEdition);
export const getTicker = () => get(fetchTicker);
export const getMarkets = () => get(fetchMarkets);
export const getMarketViews = () => get(fetchMarketViews);
export const getMarketDetail = (slug: string, range: MarketRange) => get(() => fetchMarketDetail(slug, range));
export const getHome = () => get(fetchHome);

export const getArticle = (slug: string, viewerId?: string) => get(() => fetchArticle(slug, viewerId));
export const getEditableArticle = (slug: string, userId: string) => get(() => fetchEditableArticle(slug, userId));

export function getArticles(params: {
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
  olderThanDays?: number;
  newerThanDays?: number;
}) {
  return get(() => fetchArticles(params));
}
