import type { ComponentType } from "react";
import { resolveLayout, type LayoutType } from "@/lib/layouts";
import { KIND_CARD, savedFor } from "./cards/shared";
import type { LayoutProps } from "./layouts/shared";

import BalancedEditorialLayout from "./layouts/BalancedEditorialLayout";
import FeaturedHeadlinesLayout from "./layouts/FeaturedHeadlinesLayout";
import FourColumnLayout from "./layouts/FourColumnLayout";
import HorizontalFeedLayout from "./layouts/HorizontalFeedLayout";
import LeadStoryLayout from "./layouts/LeadStoryLayout";
import MagazineLayout from "./layouts/MagazineLayout";
import OpinionLayout from "./layouts/OpinionLayout";
import PremiumCollectionLayout from "./layouts/PremiumCollectionLayout";
import ThreeColumnLayout from "./layouts/ThreeColumnLayout";
import VisualMosaicLayout from "./layouts/VisualMosaicLayout";

const REGISTRY: Record<LayoutType, ComponentType<LayoutProps>> = {
  "lead-story": LeadStoryLayout,
  "balanced-editorial": BalancedEditorialLayout,
  "three-column": ThreeColumnLayout,
  "four-column": FourColumnLayout,
  "featured-headlines": FeaturedHeadlinesLayout,
  "horizontal-feed": HorizontalFeedLayout,
  "visual-mosaic": VisualMosaicLayout,
  magazine: MagazineLayout,
  "opinion-columns": OpinionLayout,
  "premium-collection": PremiumCollectionLayout,
};

// Dynamically resolves the effective layout for the article count — small
// counts degrade per the fallback table (single card / same-family row)
// instead of rendering a half-empty arrangement.
export default function ArticleLayoutRenderer({
  layout,
  articles,
  signedIn,
  savedSlugs,
}: {
  layout: LayoutType;
} & LayoutProps) {
  const effective = resolveLayout(layout, articles.length);
  if (!effective) return null;

  if (effective.id === "single") {
    const Card = KIND_CARD[effective.kind];
    return (
      <div className="ed-single">
        <Card article={articles[0]} signedIn={signedIn} saved={savedFor(savedSlugs, articles[0].slug)} />
      </div>
    );
  }
  if (effective.id === "row") {
    const Card = KIND_CARD[effective.kind];
    return (
      <div className={`ed-row ed-row-${effective.kind}`}>
        {articles.map((article) => (
          <Card
            key={article.slug}
            article={article}
            signedIn={signedIn}
            saved={savedFor(savedSlugs, article.slug)}
          />
        ))}
      </div>
    );
  }

  const Layout = REGISTRY[effective.id];
  return <Layout articles={articles} signedIn={signedIn} savedSlugs={savedSlugs} />;
}
