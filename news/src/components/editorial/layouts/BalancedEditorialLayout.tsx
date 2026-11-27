import FeaturedCard from "../cards/FeaturedCard";
import StandardCard from "../cards/StandardCard";
import { savedFor } from "../cards/shared";
import { Tail, type LayoutProps } from "./shared";

// B — one large feature (~50%) beside a 2×2 grid of standard cards.
export default function BalancedEditorialLayout({ articles, signedIn, savedSlugs }: LayoutProps) {
  const [lead, ...rest] = articles;
  const quad = rest.slice(0, 4);
  const tail = rest.slice(4);
  return (
    <>
      <div className="ed-balanced">
        {lead && <FeaturedCard article={lead} signedIn={signedIn} saved={savedFor(savedSlugs, lead.slug)} />}
        <div className="ed-balanced-side">
          {quad.map((article) => (
            <StandardCard
              key={article.slug}
              article={article}
              signedIn={signedIn}
              saved={savedFor(savedSlugs, article.slug)}
            />
          ))}
        </div>
      </div>
      <Tail articles={tail} signedIn={signedIn} savedSlugs={savedSlugs} />
    </>
  );
}
