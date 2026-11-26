import FeaturedCard from "../cards/FeaturedCard";
import { savedFor } from "../cards/shared";
import { Tail, type LayoutProps } from "./shared";

// H — two equal large editorial stories with generous spacing.
export default function MagazineLayout({ articles, signedIn, savedSlugs }: LayoutProps) {
  const pair = articles.slice(0, 2);
  const tail = articles.slice(2);
  return (
    <>
      <div className="ed-mag">
        {pair.map((article) => (
          <FeaturedCard
            key={article.slug}
            article={article}
            signedIn={signedIn}
            saved={savedFor(savedSlugs, article.slug)}
          />
        ))}
      </div>
      <Tail articles={tail} signedIn={signedIn} savedSlugs={savedSlugs} />
    </>
  );
}
