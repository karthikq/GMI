import StandardCard from "../cards/StandardCard";
import { savedFor, type LayoutProps } from "../cards/shared";

export type { LayoutProps };

// Plain column grid of standard cards — the tail that catches articles
// beyond a structured layout's designed slots.
export function Grid({ articles, signedIn, savedSlugs, cols }: LayoutProps & { cols: 3 | 4 }) {
  if (!articles.length) return null;
  return (
    <div className={cols === 4 ? "grid four" : "grid"}>
      {articles.map((article) => (
        <StandardCard
          key={article.slug}
          article={article}
          signedIn={signedIn}
          saved={savedFor(savedSlugs, article.slug)}
        />
      ))}
    </div>
  );
}

// Articles past a layout's headline slots render as a standard three-up
// grid so nothing is silently dropped.
export function Tail(props: LayoutProps) {
  if (!props.articles.length) return null;
  return (
    <div className="ed-tail">
      <Grid {...props} cols={3} />
    </div>
  );
}
