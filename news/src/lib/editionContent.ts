// Turns raw article documents + template config into the EditionContent all
// eight formats render. The same builder feeds subscriber previews, admin
// previews, test sends and real deliveries — one rendering service.
//
// Optional blocks (market snapshot, interesting fact, poll, quiz, editor's
// note, quote) never count toward the edition's minimum article count, and
// nothing here fabricates content: markets come from the markets feed,
// polls/quizzes/facts/notes come from the template's admin-configured
// content, and article fields are used verbatim.

import { sections } from "./data";
import type { LetterTemplate, TemplateContent } from "./letterTemplates";
import type { Newsletter } from "./newsletters";

const SECTION_NAME = new Map(sections.map((s) => [s.slug, s.name]));

export type EditionStory = {
  slug: string;
  tag: string; // display category (section or subsection name)
  title: string;
  summary: string;
  url: string;
  image?: string;
  caption?: string;
  imageCredit?: string;
  readMinutes: number;
  premium?: boolean;
  featured?: boolean;
  reads?: number;
  lead?: string;
  whyItMatters?: string;
  author?: string;
  publishedAt?: string;
};

export type MarketRow = { name: string; value: string; change: number };

export type EditionExtras = {
  greetingName?: string;
  markets?: MarketRow[];
  marketsSource?: string;
  marketsAsOf?: string;
  fact?: string;
  editorsNote?: string;
  quote?: { text: string; attribution?: string };
  poll?: { question: string; options: { label: string; href: string }[] };
  quiz?: { question: string; options: { label: string; href: string }[] };
};

export type EditionContent = {
  letterName: string;
  editionDate: string;
  volNumber?: string;
  siteUrl: string;
  stories: EditionStory[];
  extras: EditionExtras;
};

type RawArticle = {
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
  publishedAt?: Date | string;
};

function absoluteImage(raw: string | undefined, siteUrl: string): string | undefined {
  if (!raw) return undefined;
  return /^https?:\/\//.test(raw) ? raw : `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export function storyFromArticle(article: RawArticle, siteUrl: string): EditionStory {
  const sectionName = SECTION_NAME.get(article.section ?? "") ?? (article.section ?? "news");
  const tag = (article.subsection ?? sectionName).toUpperCase();
  return {
    slug: article.slug,
    tag,
    title: article.title,
    summary: article.dek ?? "",
    url: `${siteUrl}/article/${article.slug}`,
    ...(absoluteImage(article.image, siteUrl) ? { image: absoluteImage(article.image, siteUrl) } : {}),
    ...(article.caption || article.city
      ? { caption: article.caption ?? `${article.city}. Photograph: Good Morning Indian` }
      : {}),
    ...(article.imageCredit ? { imageCredit: article.imageCredit } : {}),
    readMinutes: Math.max(1, Math.round(article.readMinutes ?? 4)),
    ...(article.premium || article.exclusive ? { premium: true } : {}),
    ...(article.featured ? { featured: true } : {}),
    ...(typeof article.reads === "number" ? { reads: article.reads } : {}),
    ...(article.lead ? { lead: article.lead } : {}),
    ...(article.whyItMatters ? { whyItMatters: article.whyItMatters } : {}),
    ...(article.author ? { author: article.author } : {}),
    ...(article.publishedAt ? { publishedAt: new Date(article.publishedAt).toISOString() } : {}),
  };
}

function engageExtras(
  letterId: string,
  siteUrl: string,
  content: TemplateContent | undefined,
): Pick<EditionExtras, "poll" | "quiz"> {
  const options = (
    kind: "poll" | "quiz",
    pair: { question: string; options: string[] } | undefined,
  ) =>
    pair && pair.options.length >= 2
      ? {
          question: pair.question,
          options: pair.options.map((label, i) => ({
            label,
            href: `${siteUrl}/engage/${kind}?l=${encodeURIComponent(letterId)}&o=${i}`,
          })),
        }
      : undefined;
  const poll = options("poll", content?.poll);
  const quiz = options("quiz", content?.quiz);
  return { ...(poll ? { poll } : {}), ...(quiz ? { quiz } : {}) };
}

// Market rows for the snapshot/data formats — only real feed values, never
// synthesised. Returns undefined when the feed is empty so formats omit the
// block entirely.
async function marketRows(): Promise<{ rows: MarketRow[]; asOf: string } | undefined> {
  try {
    const { fetchMarkets } = await import("./queries");
    const markets = await fetchMarkets();
    if (!markets?.length) return undefined;
    return {
      rows: markets.map((m) => ({ name: m.name, value: m.value, change: m.change })),
      asOf: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

// Builds the content a real edition renders: stored articles in frozen order
// plus the template's configured optional blocks.
export async function buildEditionContent(input: {
  letter: Newsletter;
  editionDate: string;
  articles: RawArticle[];
  siteUrl: string;
  name?: string;
  template?: LetterTemplate;
}): Promise<EditionContent> {
  const { letter, siteUrl, template } = input;
  const content = template?.content;
  const stories = input.articles.map((a) => storyFromArticle(a, siteUrl));

  const wantsMarkets =
    content?.marketSnapshot === true ||
    Boolean(template?.deskSlug && ["markets", "economy", "business"].includes(template.deskSlug));
  const markets = wantsMarkets ? await marketRows() : undefined;

  return {
    letterName: letter.name,
    editionDate: input.editionDate,
    ...(letter.sample.volNumber ? { volNumber: letter.sample.volNumber } : {}),
    siteUrl,
    stories,
    extras: {
      ...(input.name ? { greetingName: input.name } : {}),
      ...(markets
        ? { markets: markets.rows, marketsAsOf: markets.asOf, marketsSource: "Market data feed" }
        : {}),
      ...(content?.interestingFact ? { fact: content.interestingFact } : {}),
      ...(content?.editorsNote ? { editorsNote: content.editorsNote } : {}),
      ...(letter.sample.quote
        ? { quote: { text: letter.sample.quote.text, attribution: letter.sample.quote.attribution } }
        : {}),
      ...engageExtras(letter.id, siteUrl, content),
    },
  };
}


// The text/plain alternative rendered from the same content — sent alongside
// every edition and used outright for the Minimalist format.
export function editionPlainText(content: EditionContent, unsubscribeUrl?: string): string {
  const lines: string[] = [
    content.letterName.toUpperCase(),
    content.editionDate,
    "".padEnd(46, "="),
    "",
  ];
  if (content.extras.greetingName) lines.push(`Good morning, ${content.extras.greetingName}.`, "");
  content.stories.forEach((story, i) => {
    lines.push(
      `${i + 1}. ${story.title}`,
      `   ${story.tag}${story.readMinutes ? ` · ${story.readMinutes} min read` : ""}`,
      ...(story.summary ? [`   ${story.summary}`] : []),
      `   Read more: ${story.url}`,
      "",
    );
  });
  if (content.extras.markets?.length) {
    lines.push(
      "MARKETS",
      ...content.extras.markets.map(
        (m) => `   ${m.name}: ${m.value} (${m.change >= 0 ? "+" : ""}${m.change.toFixed(2)}%)`,
      ),
      `   Source: ${content.extras.marketsSource ?? "Market data"}`,
      "",
    );
  }
  if (content.extras.fact) lines.push(`DID YOU KNOW: ${content.extras.fact}`, "");
  if (content.extras.editorsNote) lines.push(`EDITOR'S NOTE: ${content.extras.editorsNote}`, "");
  lines.push(
    `Manage preferences: ${content.siteUrl}/newsletters`,
    ...(unsubscribeUrl ? [`Unsubscribe: ${unsubscribeUrl}`] : []),
    `© ${new Date().getFullYear()} Good Morning Indian`,
  );
  return lines.join("\n");
}
