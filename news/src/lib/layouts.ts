// Editorial layout system — layout registry, per-section defaults, the
// article-count fallback table and validation for admin-submitted configs.
// Kept free of database imports so the admin client bundle can use it too.

export type LayoutType =
  | "lead-story" // A — big feature left, two stacked right
  | "balanced-editorial" // B — feature left, 2x2 grid right
  | "three-column" // C — rows of three standard cards
  | "four-column" // D — rows of four standard cards
  | "featured-headlines" // E — feature left, headline list right
  | "horizontal-feed" // F — thumbnail rows, paginated feed
  | "visual-mosaic" // G — image-led mosaic
  | "magazine" // H — two equal large editorial cards
  | "opinion-columns" // I — columnist cards in a row
  | "premium-collection"; // J — dark band of premium/longform cards

// Which card family a layout renders. Drives the small-count fallbacks so
// specialised cards (opinion, visual, premium) survive downsizing.
export type CardKind = "standard" | "visual" | "opinion" | "premium";

export type LayoutMeta = {
  name: string;
  // Articles the arrangement was drawn for; extras flow into a standard
  // grid tail, shortfalls trigger the count-based fallback table.
  ideal: number;
  kind: CardKind;
  blurb: string;
};

export const LAYOUTS: Record<LayoutType, LayoutMeta> = {
  "lead-story": { name: "Lead story", ideal: 3, kind: "standard", blurb: "One large feature, two stories stacked beside it." },
  "balanced-editorial": { name: "Balanced editorial", ideal: 5, kind: "standard", blurb: "One large feature beside a 2×2 grid." },
  "three-column": { name: "Three column grid", ideal: 3, kind: "standard", blurb: "Rows of three equal cards." },
  "four-column": { name: "Four column grid", ideal: 4, kind: "standard", blurb: "Rows of four compact cards." },
  "featured-headlines": { name: "Featured with headlines", ideal: 5, kind: "standard", blurb: "One feature beside a divided headline list." },
  "horizontal-feed": { name: "Horizontal news feed", ideal: 6, kind: "standard", blurb: "Thumbnail rows for latest and archive feeds." },
  "visual-mosaic": { name: "Visual mosaic", ideal: 4, kind: "visual", blurb: "Image-led arrangement for visual stories." },
  magazine: { name: "Magazine", ideal: 2, kind: "standard", blurb: "Two equal large editorial stories." },
  "opinion-columns": { name: "Opinion columns", ideal: 3, kind: "opinion", blurb: "Columnists in a row with author credit." },
  "premium-collection": { name: "Premium collection", ideal: 3, kind: "premium", blurb: "Dark band for premium and longform pieces." },
};

export const LAYOUT_TYPES = Object.keys(LAYOUTS) as LayoutType[];

export type ArticleSource =
  | "featured" // editors' picks, pinned/breaking first then latest
  | "latest" // newest first, minus stories already shown
  | "subsection" // stories filed under block.subsectionSlug
  | "most-read" // highest read counts inside an optional day range
  | "premium" // stories flagged premium/exclusive on the document
  | "manual" // only the hand-picked slugs on the block
  | "all"; // the whole published archive — the paginated feed block

export const ARTICLE_SOURCES: ArticleSource[] = [
  "featured",
  "latest",
  "subsection",
  "most-read",
  "premium",
  "manual",
  "all",
];

export type BlockSort = "newest" | "oldest" | "most-read";
export const BLOCK_SORTS: BlockSort[] = ["newest", "oldest", "most-read"];

export type LayoutBlock = {
  id: string;
  title: string;
  layout: LayoutType;
  source: ArticleSource;
  // Required when source is "subsection"; must be a child of the section.
  subsectionSlug?: string;
  articleCount: number;
  // Hand-picked article slugs; shown first for "featured"/"manual" blocks.
  selectedArticles?: string[];
  sort?: BlockSort;
  // Optional window for "most-read" blocks; unset means all time.
  timeRangeDays?: number;
  displayOrder: number;
  enabled: boolean;
};

// Auto-generated subsection collections: the featured subsections of a
// section each get a block rendered at `displayOrder` among the blocks.
export type CollectionsConfig = {
  enabled: boolean;
  layout: LayoutType;
  articleCount: number;
  // Cap on how many subsection collections a section page shows.
  max: number;
  displayOrder: number;
};

export type SectionLayoutConfig = {
  sectionSlug: string;
  subsectionSlug?: string;
  blocks: LayoutBlock[];
  collections: CollectionsConfig;
};

// Default layout triple per section (top stories / latest / collections).
const SECTION_DEFAULTS: Record<string, { top: LayoutType; latest: LayoutType; collections: LayoutType }> = {
  india: { top: "balanced-editorial", latest: "horizontal-feed", collections: "three-column" },
  world: { top: "balanced-editorial", latest: "horizontal-feed", collections: "three-column" },
  politics: { top: "featured-headlines", latest: "horizontal-feed", collections: "three-column" },
  business: { top: "lead-story", latest: "three-column", collections: "four-column" },
  markets: { top: "featured-headlines", latest: "horizontal-feed", collections: "four-column" },
  technology: { top: "balanced-editorial", latest: "three-column", collections: "four-column" },
  science: { top: "lead-story", latest: "three-column", collections: "magazine" },
  sports: { top: "balanced-editorial", latest: "horizontal-feed", collections: "four-column" },
  entertainment: { top: "visual-mosaic", latest: "four-column", collections: "three-column" },
  culture: { top: "magazine", latest: "three-column", collections: "visual-mosaic" },
  lifestyle: { top: "visual-mosaic", latest: "four-column", collections: "three-column" },
  health: { top: "lead-story", latest: "horizontal-feed", collections: "three-column" },
  education: { top: "featured-headlines", latest: "horizontal-feed", collections: "three-column" },
  environment: { top: "lead-story", latest: "three-column", collections: "magazine" },
  travel: { top: "visual-mosaic", latest: "four-column", collections: "magazine" },
  automobile: { top: "balanced-editorial", latest: "four-column", collections: "three-column" },
  gaming: { top: "visual-mosaic", latest: "four-column", collections: "three-column" },
  opinion: { top: "opinion-columns", latest: "horizontal-feed", collections: "opinion-columns" },
  "in-pictures": { top: "visual-mosaic", latest: "visual-mosaic", collections: "magazine" },
  longform: { top: "magazine", latest: "premium-collection", collections: "three-column" },
  economy: { top: "featured-headlines", latest: "horizontal-feed", collections: "three-column" },
};

const GENERIC_DEFAULT = { top: "lead-story", latest: "horizontal-feed", collections: "three-column" as LayoutType };

// Latest-blocks get a slightly bigger count when the layout eats rows.
const LATEST_COUNT: Partial<Record<LayoutType, number>> = {
  "three-column": 6,
  "four-column": 8,
  "horizontal-feed": 6,
  "visual-mosaic": 8,
  "premium-collection": 3,
  magazine: 2,
};

export const FEED_PAGE_SIZE = 12;
const COLLECTION_MAX = 4;

let blockSeq = 0;
const blockId = () => `b${Date.now().toString(36)}${(blockSeq += 1).toString(36)}`;

// The stock page program for a section: top stories, latest, auto
// collections of featured subsections, then the paginated archive feed.
export function defaultSectionConfig(sectionSlug: string, sectionName?: string): SectionLayoutConfig {
  const pick = SECTION_DEFAULTS[sectionSlug] ?? GENERIC_DEFAULT;
  return {
    sectionSlug,
    blocks: [
      {
        id: "top-stories",
        title: "Top Stories",
        layout: pick.top,
        source: "featured",
        articleCount: LAYOUTS[pick.top].ideal,
        sort: "newest",
        displayOrder: 1,
        enabled: true,
      },
      {
        id: "latest-news",
        title: "Latest News",
        layout: pick.latest,
        source: "latest",
        articleCount: LATEST_COUNT[pick.latest] ?? LAYOUTS[pick.latest].ideal,
        sort: "newest",
        displayOrder: 2,
        enabled: true,
      },
      {
        id: "all-articles",
        title: `All ${sectionName ?? "Section"} News`,
        layout: "horizontal-feed",
        source: "all",
        articleCount: FEED_PAGE_SIZE,
        sort: "newest",
        displayOrder: 4,
        enabled: true,
      },
    ],
    collections: {
      enabled: true,
      layout: pick.collections,
      articleCount: LAYOUTS[pick.collections].ideal,
      max: COLLECTION_MAX,
      displayOrder: 3,
    },
  };
}

// ── Article-count fallback ────────────────────────────────────────────────
// The configured layout only renders when it can be filled believably;
// smaller counts degrade to a simpler arrangement that keeps the layout's
// card family. Internal ids are rendered by the same switch as the public
// layouts — "single" shows one big card, "row" shows n cards of the kind.

export type EffectiveLayout =
  | { id: LayoutType }
  | { id: "single" | "row"; kind: CardKind };

const STANDARD_FALLBACK: Record<number, LayoutType> = {
  3: "three-column",
  4: "four-column",
  5: "balanced-editorial",
};

export function resolveLayout(configured: LayoutType, count: number): EffectiveLayout | null {
  if (count <= 0) return null;
  const meta = LAYOUTS[configured];
  const kind = meta.kind;

  if (count === 1) return { id: "single", kind };
  if (count === 2) return kind === "standard" ? { id: "magazine" } : { id: "row", kind };

  // Grids, feeds, opinion and premium rows all cope with any count.
  if (count >= meta.ideal) return { id: configured };

  // Short of the ideal: degrade inside the same card family.
  if (kind !== "standard") return { id: "row", kind };
  return { id: STANDARD_FALLBACK[count] ?? "horizontal-feed" };
}

// ── Admin input validation ────────────────────────────────────────────────

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function sanitizeBlock(input: unknown, validSubSlugs: string[]): LayoutBlock | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const layout = String(raw.layout ?? "") as LayoutType;
  const source = String(raw.source ?? "") as ArticleSource;
  if (!LAYOUT_TYPES.includes(layout) || !ARTICLE_SOURCES.includes(source)) return null;

  const subsectionSlug = raw.subsectionSlug ? String(raw.subsectionSlug) : undefined;
  if (source === "subsection" && (!subsectionSlug || !validSubSlugs.includes(subsectionSlug))) {
    return null;
  }
  const articleCount = Math.min(Math.max(Math.floor(Number(raw.articleCount)) || 0, 1), 24);
  const sort = BLOCK_SORTS.includes(raw.sort as BlockSort) ? (raw.sort as BlockSort) : "newest";
  const timeRangeDays =
    typeof raw.timeRangeDays === "number" && raw.timeRangeDays > 0 && raw.timeRangeDays <= 365
      ? Math.floor(raw.timeRangeDays)
      : undefined;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 40) : blockId(),
    title: String(raw.title ?? "").trim().slice(0, 60) || LAYOUTS[layout].name,
    layout,
    source,
    ...(subsectionSlug && validSubSlugs.includes(subsectionSlug) ? { subsectionSlug } : {}),
    articleCount,
    selectedArticles: (Array.isArray(raw.selectedArticles) ? raw.selectedArticles : [])
      .map((slug) => String(slug).trim().toLowerCase())
      .filter((slug) => SLUG.test(slug))
      .slice(0, 24),
    sort,
    ...(timeRangeDays ? { timeRangeDays } : {}),
    displayOrder: Math.min(Math.max(Math.floor(Number(raw.displayOrder)) || 0, 0), 99),
    enabled: raw.enabled !== false,
  };
}

// Validates a whole submitted config; returns an error string or the clean
// blocks. `validSubSlugs` are the section's real children — blocks pointing
// anywhere else are rejected rather than silently dropped.
export function sanitizeLayoutInput(
  input: unknown,
  validSubSlugs: string[],
): { blocks: LayoutBlock[]; collections: CollectionsConfig } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Nothing to save." };
  const raw = input as { blocks?: unknown; collections?: unknown };
  const list = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = list
    .map((item) => sanitizeBlock(item, validSubSlugs))
    .filter((block): block is LayoutBlock => Boolean(block))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  if (!blocks.length) return { error: "Add at least one content block." };

  const rawCollections = (raw.collections ?? {}) as Record<string, unknown>;
  const collections: CollectionsConfig = {
    enabled: rawCollections.enabled !== false,
    layout: LAYOUT_TYPES.includes(rawCollections.layout as LayoutType)
      ? (rawCollections.layout as LayoutType)
      : "three-column",
    articleCount: Math.min(Math.max(Math.floor(Number(rawCollections.articleCount)) || 3, 1), 12),
    max: Math.min(Math.max(Math.floor(Number(rawCollections.max)) || 3, 1), 8),
    displayOrder: Math.min(Math.max(Math.floor(Number(rawCollections.displayOrder)) || 3, 0), 99),
  };
  return { blocks, collections };
}
