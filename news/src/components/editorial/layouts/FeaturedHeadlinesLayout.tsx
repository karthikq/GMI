import FeaturedCard from "../cards/FeaturedCard";
import CompactCard from "../cards/CompactCard";
import { savedFor } from "../cards/shared";
import { Tail, type LayoutProps } from "./shared";

// E — one large feature beside a stacked headline list with thin dividers.
export default function FeaturedHeadlinesLayout({ articles, signedIn, savedSlugs }: LayoutProps) {
  const [lead, ...rest] = articles;
  const headlines = rest.slice(0, 4);
  const tail = rest.slice(4);
  return (
    <>
      <div className="ed-feat-head">
        {lead && <FeaturedCard article={lead} signedIn={signedIn} saved={savedFor(savedSlugs, lead.slug)} />}
        <div className="ed-headlines">
          {headlines.map((article) => (
            <CompactCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
      <Tail articles={tail} signedIn={signedIn} savedSlugs={savedSlugs} />
    </>
  );
}
