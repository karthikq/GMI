import { connection } from "next/server";
import {
  fetchArticle,
  fetchArticles,
  fetchEdition,
  fetchHome,
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
  inlineImage?: string;
  inlineCaption?: string;
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

export type Market = { name: string; value: string; change: number };

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
export const getHome = () => get(fetchHome);

export const getArticle = (slug: string) => get(() => fetchArticle(slug));

export function getArticles(params: {
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
  olderThanDays?: number;
}) {
  return get(() => fetchArticles(params));
}
