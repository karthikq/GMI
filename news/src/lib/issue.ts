import { collections, connect } from "./db";

// Loads the articles a frozen edition renders — the slugs stored at
// generation time, in pick order, so retries resend exactly this content.

export type EditionArticleDoc = {
  slug: string;
  title: string;
  dek?: string;
  section?: string;
  subsection?: string;
  image?: string;
  readMinutes?: number;
  lead?: string;
  whyItMatters?: string;
  premium?: boolean;
  exclusive?: boolean;
  author?: string;
  city?: string;
  caption?: string;
  imageCredit?: string;
  reads?: number;
  featured?: boolean;
  publishedAt?: Date;
};

const PROJECTION = {
  slug: 1,
  title: 1,
  dek: 1,
  section: 1,
  subsection: 1,
  image: 1,
  readMinutes: 1,
  lead: 1,
  whyItMatters: 1,
  premium: 1,
  exclusive: 1,
  author: 1,
  city: 1,
  caption: 1,
  imageCredit: 1,
  reads: 1,
  featured: 1,
  publishedAt: 1,
} as const;

export async function articlesBySlugs(slugs: string[]): Promise<EditionArticleDoc[]> {
  if (!slugs.length) return [];
  await connect();
  const docs = await collections.articles
    .find<EditionArticleDoc>({ slug: { $in: slugs } }, { projection: PROJECTION })
    .toArray();
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs.map((slug) => bySlug.get(slug)).filter((doc): doc is EditionArticleDoc => Boolean(doc));
}
