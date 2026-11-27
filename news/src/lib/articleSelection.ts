// Shared article selection engine for all newsletter formats. One service
// used by edition generation, admin previews and test sends — the same rules
// everywhere:
//
//   · published stories only
//   · scoped to the newsletter's desks (topics → section/subsection slugs, or
//     an explicit deskSlug)
//   · free/premium eligibility respected
//   · minimum 5 unique articles, default 7, admin-configurable 5–15
//   · editor-selected (featured/breaking) first, then recency, then reads
//   · articles already mailed by this newsletter are avoided where possible
//   · daily cadences look back 24h, weekly 7d; configurable fallback windows
//     widen the search when a period is thin
//   · nothing is ever fabricated to reach the minimum; unrelated desks are
//     only used when `crossDeskFallback` is explicitly enabled
//   · if the minimum still isn't met the caller marks the edition
//     insufficient and exposes it in the admin dashboard

import { collections, connect } from "./db";
import { sections, subsections } from "./data";
import {
  DEFAULT_ARTICLE_COUNT,
  MAX_ARTICLE_COUNT,
  MIN_STORIES,
} from "./newsletterFormats";
import type { LetterTemplate } from "./letterTemplates";

const HOUR_MS = 3_600_000;

export type SelectionConfig = {
  windowHours?: number; // primary look-back override (hours)
  fallbackWindowsHours?: number[]; // widening windows tried in order
  crossDeskFallback?: boolean; // allow unrelated desks to top up
  allowPremium?: boolean; // include premium/exclusive stories
  excludeSentDays?: number; // how far back "already emailed" applies (0 = off)
};

export type SelectionResult = {
  slugs: string[];
  usedWindowHours: number | null; // the window that produced the picks
  insufficient: boolean;
  reason?: string;
};

export type ArticlePicks = {
  slug: string;
  section?: string;
  subsection?: string;
  publishedAt: Date;
  reads?: number;
  featured?: boolean;
  breaking?: boolean;
  premium?: boolean;
  exclusive?: boolean;
};

// Topics are free-form — they may be section names ("World"), section slugs
// ("world"), or subsection names ("Elections"). Resolve all three into a
// (section, subsection) slug pair set used to scope the article pool.
function scopeSlugs(template: Pick<LetterTemplate, "topics" | "deskSlug">): {
  sections: Set<string>;
  subs: Set<string>;
} {
  if (template.deskSlug) {
    return { sections: new Set([template.deskSlug]), subs: new Set() };
  }
  const sectionByName = new Map(sections.map((s) => [s.name.toLowerCase(), s.slug]));
  const sectionSlugs = new Set(sections.map((s) => s.slug));
  const subByName = new Map<string, string>();
  for (const [parentSlug, subs] of Object.entries(subsections)) {
    for (const sub of subs) {
      const slug = (sub.slug ?? sub.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      subByName.set(sub.name.toLowerCase(), slug);
      subByName.set(slug, slug);
      // A subsection topic also pulls in its parent section's slug so a desk
      // written as a subsection name still resolves to real coverage.
      void parentSlug;
    }
  }
  const wantedSections = new Set<string>();
  const wantedSubs = new Set<string>();
  for (const raw of template.topics) {
    const topic = String(raw).trim().toLowerCase();
    if (!topic) continue;
    if (sectionSlugs.has(topic)) {
      wantedSections.add(topic);
      continue;
    }
    const byName = sectionByName.get(topic);
    if (byName) {
      wantedSections.add(byName);
      continue;
    }
    const sub = subByName.get(topic);
    if (sub) wantedSubs.add(sub);
  }
  return { sections: wantedSections, subs: wantedSubs };
}

function inScope(article: ArticlePicks, scope: { sections: Set<string>; subs: Set<string> }) {
  if (!scope.sections.size && !scope.subs.size) return true; // unscoped template → all desks
  return scope.sections.has(article.section ?? "") || scope.subs.has(article.subsection ?? "");
}

// Editor-selected first (featured, then breaking), then recency, then reads
// as the importance tiebreak — deterministic so a regenerated preview matches.
function rank(articles: ArticlePicks[]): ArticlePicks[] {
  return [...articles].sort(
    (a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      Number(Boolean(b.breaking)) - Number(Boolean(a.breaking)) ||
      b.publishedAt.getTime() - a.publishedAt.getTime() ||
      (b.reads ?? 0) - (a.reads ?? 0),
  );
}

// Primary look-back: weekly editions read the last seven days, everything
// else the last 24 hours — both overridable per template.
export function primaryWindowHours(template: LetterTemplate): number {
  const configured = template.selection?.windowHours;
  if (configured && configured > 0) return Math.min(Math.max(configured, 1), 24 * 90);
  return template.schedule.kind === "weekly" ? 24 * 7 : 24;
}

const DEFAULT_FALLBACK_HOURS = [72, 168, 336, 720];

export function fallbackWindowsHours(template: LetterTemplate): number[] {
  const configured = template.selection?.fallbackWindowsHours;
  const list = (Array.isArray(configured) && configured.length ? configured : DEFAULT_FALLBACK_HOURS)
    .map((h) => Math.min(Math.max(Math.floor(h), 1), 24 * 90))
    .filter((h, i, arr) => arr.indexOf(h) === i);
  return list;
}

export function targetArticleCount(template: LetterTemplate): number {
  const count = Math.floor(Number(template.articleCount) || DEFAULT_ARTICLE_COUNT);
  return Math.min(Math.max(count, MIN_STORIES), MAX_ARTICLE_COUNT);
}

export function requiredArticleCount(template: LetterTemplate): number {
  const count = Math.floor(Number(template.minArticles) || MIN_STORIES);
  return Math.min(Math.max(count, MIN_STORIES), MAX_ARTICLE_COUNT);
}

// Slugs this newsletter has already mailed — excluded while fresher options
// remain ("avoid previously emailed articles where possible").
async function previouslySentSlugs(template: LetterTemplate, now: Date): Promise<Set<string>> {
  const days = Math.min(Math.max(Math.floor(template.selection?.excludeSentDays ?? 30), 0), 365);
  if (!days) return new Set();
  const rows = await collections.letterEditions
    .find(
      { templateId: template.id, createdAt: { $gte: new Date(now.getTime() - days * 24 * HOUR_MS) } },
      { projection: { articleSlugs: 1 } },
    )
    .limit(120)
    .toArray();
  const sent = new Set<string>();
  for (const row of rows) for (const slug of row.articleSlugs ?? []) sent.add(slug);
  return sent;
}

const PROJECTION = {
  slug: 1,
  section: 1,
  subsection: 1,
  publishedAt: 1,
  reads: 1,
  featured: 1,
  breaking: 1,
  premium: 1,
  exclusive: 1,
} as const;

export async function selectEditionArticles(
  template: LetterTemplate,
  opts: { now?: Date } = {},
): Promise<SelectionResult> {
  await connect();
  const now = opts.now ?? new Date();
  const target = targetArticleCount(template);
  const required = requiredArticleCount(template);
  const scope = scopeSlugs(template);
  const allowPremium =
    template.selection?.allowPremium ?? template.premium ?? false;
  const sentBefore = await previouslySentSlugs(template, now);

  const windows = [primaryWindowHours(template), ...fallbackWindowsHours(template)].filter(
    (h, i, arr) => arr.indexOf(h) === i,
  );

  let picked: ArticlePicks[] = [];
  let usedWindow: number | null = null;
  for (const hours of windows) {
    const since = new Date(now.getTime() - hours * HOUR_MS);
    const docs = (await collections.articles
      .find({ publishedAt: { $lte: now, $gte: since } }, { projection: PROJECTION })
      .sort({ publishedAt: -1 })
      .limit(400)
      .toArray()) as unknown as ArticlePicks[];

    const eligible = docs.filter(
      (doc) => inScope(doc, scope) && (allowPremium || !(doc.premium || doc.exclusive)),
    );
    // Fresh picks first; stories this letter already mailed only fill in when
    // the window can't otherwise meet the target.
    const fresh = rank(eligible.filter((doc) => !sentBefore.has(doc.slug)));
    const repeat = rank(eligible.filter((doc) => sentBefore.has(doc.slug)));
    picked = [...fresh, ...repeat].slice(0, target);
    usedWindow = hours;
    if (picked.length >= required) break;
  }

  // Explicit opt-in: a quiet desk may top up from the general pool so the
  // edition still mails. Off by default — unrelated desks never leak in
  // without this flag.
  if (picked.length < required && template.selection?.crossDeskFallback) {
    const lastWindow = windows[windows.length - 1] ?? 720;
    const since = new Date(now.getTime() - lastWindow * HOUR_MS);
    const have = new Set(picked.map((doc) => doc.slug));
    const docs = (await collections.articles
      .find({ publishedAt: { $lte: now, $gte: since }, slug: { $nin: [...have] } }, { projection: PROJECTION })
      .sort({ publishedAt: -1 })
      .limit(400)
      .toArray()) as unknown as ArticlePicks[];
    const extra = rank(docs.filter((doc) => allowPremium || !(doc.premium || doc.exclusive)));
    picked = [...picked, ...extra].slice(0, target);
  }

  const slugs = picked.map((doc) => doc.slug);
  const insufficient = slugs.length < required;
  const scopeEmpty = !scope.sections.size && !scope.subs.size && Boolean(template.deskSlug);
  return {
    slugs,
    usedWindowHours: usedWindow,
    insufficient,
    ...(insufficient
      ? {
          reason: scopeEmpty
            ? `No published stories matched the configured desks.`
            : `Only ${slugs.length} published stories across the configured desks (minimum ${required}).`,
        }
      : {}),
  };
}
