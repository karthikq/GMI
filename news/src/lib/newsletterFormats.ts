// The eight supported newsletter email formats. `id` is stored on the
// subscriber's `letterFormats` map and on `letterDeliveries.format`, so ids
// are stable once shipped. DAILY_DIGEST is the default — every unrecognised
// or missing value resolves to it.
//
// Legacy ids ("daily", "classic", "corporate", "heritage", "scrapbook",
// "storefront", "skyline", "digest") remain readable forever via
// LEGACY_FORMAT_MAP — stored picks are normalised at read/write time, so
// existing subscriptions keep working without a data migration.

export const MIN_STORIES = 5;
export const DEFAULT_ARTICLE_COUNT = 7;
export const MAX_ARTICLE_COUNT = 15;

export type NewsletterFormatId =
  | "quick_read"
  | "daily_digest"
  | "full_edition"
  | "visual_edition"
  | "deep_dive"
  | "data_brief"
  | "readers_edition"
  | "minimalist";

export type NewsletterFormat = {
  id: NewsletterFormatId;
  // Spec display code (QUICK_READ …) — surfaced in the admin centre.
  code: string;
  name: string;
  style: string;
  description: string;
  // Estimated reading time shown on the format picker.
  readTime: string;
  minStories: number;
  hasImages: boolean;
  // Only the default format is free; the rest are a paid-plan perk.
  premium: boolean;
};

export const NEWSLETTER_FORMATS: NewsletterFormat[] = [
  {
    id: "daily_digest",
    code: "DAILY_DIGEST",
    name: "Daily Digest",
    style: "Featured story + headline cards",
    description:
      "A personalised greeting, one featured story with a large image, and the day's essential cards with reading times.",
    readTime: "≈ 4 min",
    minStories: MIN_STORIES,
    hasImages: true,
    premium: false,
  },
  {
    id: "quick_read",
    code: "QUICK_READ",
    name: "Quick Read",
    style: "Numbered, scannable briefing",
    description:
      "Numbered stories with a category, headline and a tight summary — the whole edition in under two minutes.",
    readTime: "≈ 2 min",
    minStories: MIN_STORIES,
    hasImages: false,
    premium: true,
  },
  {
    id: "full_edition",
    code: "FULL_EDITION",
    name: "Full Edition",
    style: "Classic newspaper layout",
    description:
      "The complete paper: a large lead story, Why It Matters, editorial cards and optional opinion and analysis.",
    readTime: "≈ 8 min",
    minStories: MIN_STORIES,
    hasImages: true,
    premium: true,
  },
  {
    id: "visual_edition",
    code: "VISUAL_EDITION",
    name: "Visual Edition",
    style: "Photo-first two-column gallery",
    description:
      "A photographic lead story and an image-first gallery with captions and credits where required.",
    readTime: "≈ 5 min",
    minStories: MIN_STORIES,
    hasImages: true,
    premium: true,
  },
  {
    id: "deep_dive",
    code: "DEEP_DIVE",
    name: "Deep Dive",
    style: "Magazine analysis, charcoal & gold",
    description:
      "One story in depth — background, context and Why It Matters — with related analysis and reading times.",
    readTime: "≈ 10 min",
    minStories: MIN_STORIES,
    hasImages: true,
    premium: true,
  },
  {
    id: "data_brief",
    code: "DATA_BRIEF",
    name: "Data Brief",
    style: "Numbers, charts & sources",
    description:
      "The edition in numbers — market indices, statistics with sources, and a data-led featured story.",
    readTime: "≈ 4 min",
    minStories: MIN_STORIES,
    hasImages: false,
    premium: true,
  },
  {
    id: "readers_edition",
    code: "READERS_EDITION",
    name: "Reader's Edition",
    style: "Stories plus poll & quiz",
    description:
      "The day's stories plus a reader poll, a quiz, discussion prompts and recommendations.",
    readTime: "≈ 6 min",
    minStories: MIN_STORIES,
    hasImages: true,
    premium: true,
  },
  {
    id: "minimalist",
    code: "MINIMALIST",
    name: "Minimalist",
    style: "Plain-text personal letter",
    description:
      "No images, no cards — a personal letter with the stories that matter, written for quiet reading.",
    readTime: "≈ 3 min",
    minStories: MIN_STORIES,
    hasImages: false,
    premium: true,
  },
];

export const DEFAULT_FORMAT_ID: NewsletterFormatId = "daily_digest";

// Backward-compatible migration for format values stored before the eight
// editorial formats shipped (letterTemplates.formats, subscriber
// letterFormats, letterDeliveries.format).
export const LEGACY_FORMAT_MAP: Record<string, NewsletterFormatId> = {
  daily: "daily_digest",
  digest: "quick_read",
  classic: "full_edition",
  storefront: "visual_edition",
  scrapbook: "visual_edition",
  skyline: "deep_dive",
  heritage: "full_edition",
  corporate: "data_brief",
};

const FORMAT_IDS = new Set<string>(NEWSLETTER_FORMATS.map((f) => f.id));

// Any value we accept as a format pick — new ids or migratable legacy ids.
export function isKnownFormatId(raw: unknown): raw is string {
  return typeof raw === "string" && (FORMAT_IDS.has(raw) || raw in LEGACY_FORMAT_MAP);
}

// Resolves any stored value to a current format id — legacy ids migrate,
// unknown or missing values fall back to the default.
export function normalizeFormatId(raw: unknown): NewsletterFormatId {
  if (typeof raw === "string") {
    if (FORMAT_IDS.has(raw)) return raw as NewsletterFormatId;
    const migrated = LEGACY_FORMAT_MAP[raw];
    if (migrated) return migrated;
  }
  return DEFAULT_FORMAT_ID;
}

export function getFormat(id: unknown): NewsletterFormat {
  const resolved = normalizeFormatId(id);
  return NEWSLETTER_FORMATS.find((item) => item.id === resolved) ?? NEWSLETTER_FORMATS[0];
}

// Dedupes a stored formats array through the migration map — used when
// reading letterTemplates docs written against the legacy catalogue.
export function normalizeFormatList(raw: unknown): NewsletterFormatId[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<NewsletterFormatId>();
  for (const item of raw) {
    if (isKnownFormatId(item)) out.add(normalizeFormatId(item));
  }
  return [...out];
}
