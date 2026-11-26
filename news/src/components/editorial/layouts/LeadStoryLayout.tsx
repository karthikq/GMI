import FeaturedCard from "../cards/FeaturedCard";
import StandardCard from "../cards/StandardCard";
import { savedFor } from "../cards/shared";
import { Tail, type LayoutProps } from "./shared";

// A — one large feature (~65%) beside two stacked stories.
export default function LeadStoryLayout({ articles, signedIn, savedSlugs }: LayoutProps) {
  const [lead, ...rest] = articles;
  const rail = rest.slice(0, 2);
  const tail = rest.slice(2);
  return (
    <>
      <div className="ed-lead">
        {lead && <FeaturedCard article={lead} signedIn={signedIn} saved={savedFor(savedSlugs, lead.slug)} />}
        <div className="ed-lead-side">
          {rail.map((article) => (
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
