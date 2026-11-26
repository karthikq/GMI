import Link from "next/link";
import { ArticleImage, Meta } from "@/components/ArticleCard";
import SaveButton from "@/components/SaveButton";
import type { Article } from "@/lib/api";
import type { CardKind } from "@/lib/layouts";

export { ArticleImage, Meta };

// Everything a card needs beyond the article itself. `saved` is the current
// bookmark state for this story (fetched once for the whole page); cards
// only render the bookmark button when `signedIn` was passed in.
export type CardProps = {
  article: Article;
  signedIn?: boolean;
  saved?: boolean;
};

export type LayoutProps = {
  articles: Article[];
  signedIn?: boolean;
  savedSlugs?: ReadonlySet<string>;
};

export const savedFor = (savedSlugs: ReadonlySet<string> | undefined, slug: string) =>
  Boolean(savedSlugs?.has(slug));

export const articleHref = (article: Article) => `/article/${article.slug}`;

// Deepest category label available — subsection wins over section so a
// Karnataka story reads "Karnataka" rather than "India".
export function Kicker({ article }: { article: Article }) {
  const href = article.subsection
    ? `/${article.section}/${article.subsection}`
    : `/${article.section}`;
  const label = article.subsectionName ?? article.sectionName;
  return (
    <Link href={href} className="kicker">
      {label}
    </Link>
  );
}

export function Bookmark({ article, signedIn, saved }: CardProps) {
  if (signedIn === undefined) return null;
  return <SaveButton slug={article.slug} section={article.section} initialSaved={Boolean(saved)} signedIn={signedIn} />;
}

// Small flag shown on cards when the story is marked premium/exclusive.
export function PremiumBadge({ label = "Premium" }: { label?: string }) {
  return (
    <span className="premium-badge">
      <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true">
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

// Initials circle used where a columnist has no stored photo.
export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Pick the card component for a layout's card family — used by the
// count-based fallbacks ("single", "row") that keep the family's look.
import FeaturedCard from "./FeaturedCard";
import OpinionCard from "./OpinionCard";
import PremiumCard from "./PremiumCard";
import VisualCard from "./VisualCard";

export const KIND_CARD = {
  standard: FeaturedCard,
  visual: VisualCard,
  opinion: OpinionCard,
  premium: PremiumCard,
} as const;

export const cardKindOf = (kind: CardKind) => KIND_CARD[kind];
