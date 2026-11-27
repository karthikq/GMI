import Link from "next/link";
import { articleHref, ArticleImage, Bookmark, Kicker, Meta, PremiumBadge, type CardProps } from "./shared";

// The lead-story card: big 16:9 image, kicker, large headline, standfirst,
// byline line and a bookmark action.
export default function FeaturedCard({ article, signedIn, saved }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="ed-featured">
      <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
        <ArticleImage article={article} />
      </Link>
      <div className="ed-featured-body">
        <div className="ed-labels">
          <Kicker article={article} />
          {article.premium && <PremiumBadge />}
        </div>
        <h2>
          <Link href={href}>{article.title}</Link>
        </h2>
        <p className="dek">{article.dek}</p>
        <div className="ed-card-foot">
          <Meta article={article} />
          <Bookmark article={article} signedIn={signedIn} saved={saved} />
        </div>
      </div>
    </article>
  );
}
