import Link from "next/link";
import type { LayoutType } from "@/lib/layouts";
import ArticleLayoutRenderer from "./ArticleLayoutRenderer";
import type { LayoutProps } from "./layouts/shared";

// One titled content block on a section page — heading rule, optional
// "View all" link, then the resolved layout. The premium collection renders
// inside the dark full-bleed band instead of a plain block.
export default function SectionBlock({
  title,
  viewAll,
  layout,
  articles,
  signedIn,
  savedSlugs,
}: {
  title: string;
  viewAll?: string;
  layout: LayoutType;
} & LayoutProps) {
  if (!articles.length) return null;

  const head = (
    <div className="section-head">
      <h2>{title}</h2>
      {viewAll && (
        <Link href={viewAll} className="more">
          View all →
        </Link>
      )}
    </div>
  );
  const body = (
    <ArticleLayoutRenderer
      layout={layout}
      articles={articles}
      signedIn={signedIn}
      savedSlugs={savedSlugs}
    />
  );

  if (layout === "premium-collection") {
    return (
      <section className="band dark ed-block">
        {head}
        {body}
      </section>
    );
  }
  return (
    <section className="section-block">
      {head}
      {body}
    </section>
  );
}
