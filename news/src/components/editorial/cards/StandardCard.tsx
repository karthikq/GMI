import Link from "next/link";
import { articleHref, ArticleImage, Bookmark, Kicker, Meta, PremiumBadge, type CardProps } from "./shared";

// The workhorse card — medium image, label, headline, short excerpt, meta
// and a bookmark action. Used by the column grids and layout tails.
export default function StandardCard({ article, signedIn, saved }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="card ed-standard">
      <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
        <ArticleImage article={article} />
      </Link>
      <div className="card-body">
        <div className="ed-labels">
          <Kicker article={article} />
          {article.premium && <PremiumBadge />}
        </div>
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
        <p className="dek ed-excerpt">{article.dek}</p>
        <div className="ed-card-foot">
          <Meta article={article} />
          <Bookmark article={article} signedIn={signedIn} saved={saved} />
        </div>
      </div>
    </article>
  );
}
