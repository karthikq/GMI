import { collections, connect } from "./db";
import { sections } from "./data";
import type { Newsletter, SampleStory } from "./newsletters";

// Builds a real newsletter issue from published stories so delivered emails
// carry today's journalism instead of the letter's canned sample edition.
// Returns the letter unchanged when no stories can be loaded — the sample
// stays a fallback for empty/dev databases.

const SECTION_BY_NAME = new Map(sections.map((s) => [s.name.toLowerCase(), s.slug]));

type ArticleDoc = {
  slug: string;
  title: string;
  dek?: string;
  section?: string;
  image?: string;
};

async function latestArticles(slugs: string[], limit: number): Promise<ArticleDoc[]> {
  await connect();
  const projection = { slug: 1, title: 1, dek: 1, section: 1, image: 1 };
  const scoped = slugs.length
    ? await collections.articles
        .find<ArticleDoc>({ section: { $in: slugs } }, { projection })
        .sort({ publishedAt: -1 })
        .limit(limit)
        .toArray()
    : [];
  if (scoped.length >= Math.min(3, limit)) return scoped;
  const have = new Set(scoped.map((a) => a.slug));
  const rest = await collections.articles
    .find<ArticleDoc>({ slug: { $nin: [...have] } }, { projection })
    .sort({ publishedAt: -1 })
    .limit(limit - scoped.length)
    .toArray();
  return [...scoped, ...rest];
}

export async function buildIssueLetter(
  letter: Newsletter,
  issueDate: string,
  siteUrl: string,
  limit = 6,
): Promise<Newsletter> {
  const slugs = letter.topics
    .map((topic) => SECTION_BY_NAME.get(topic.toLowerCase()))
    .filter((slug): slug is string => Boolean(slug));
  const articles = await latestArticles(slugs, limit).catch(() => [] as ArticleDoc[]);
  if (!articles.length) return letter;
  return letterFromArticles(letter, articles, issueDate, siteUrl);
}

// Published articles for a frozen edition, in the order they were picked at
// generation time — retries resend exactly this content.
export async function articlesBySlugs(slugs: string[]): Promise<ArticleDoc[]> {
  if (!slugs.length) return [];
  await connect();
  const docs = await collections.articles
    .find<ArticleDoc>({ slug: { $in: slugs } }, { projection: { slug: 1, title: 1, dek: 1, section: 1, image: 1 } })
    .toArray();
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return slugs.map((slug) => bySlug.get(slug)).filter((doc): doc is ArticleDoc => Boolean(doc));
}

// Merge picked articles into a letter's sample — the issue body the email
// renders. Shared by the live picker and the frozen-edition path.
export function letterFromArticles(
  letter: Newsletter,
  articles: ArticleDoc[],
  issueDate: string,
  siteUrl: string,
): Newsletter {
  if (!articles.length) return letter;

  const stories: SampleStory[] = articles.map((article) => {
    const raw = article.image ?? "";
    const image = !raw
      ? undefined
      : /^https?:\/\//.test(raw)
        ? raw
        : `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
    return {
      tag: (article.section ?? "news").toUpperCase(),
      title: article.title,
      summary: article.dek ?? "",
      image,
      url: `${siteUrl}/article/${article.slug}`,
    };
  });
  const [lead] = stories;
  return {
    ...letter,
    sample: {
      ...letter.sample,
      date: issueDate,
      headline: lead.title,
      leadDek: lead.summary || letter.sample.leadDek,
      stories,
    },
  };
}
