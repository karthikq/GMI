import Link from "next/link";
import { articleHref, ArticleImage, Kicker, Meta, PremiumBadge, type CardProps } from "./shared";

// Thumbnail-left row for latest news, search-style results and the
// paginated archive feed.
export default function HorizontalCard({ article }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="ed-hcard">
      <Link href={href} className="card-image ed-hcard-image" tabIndex={-1} aria-hidden="true">
        <ArticleImage article={article} />
      </Link>
      <div className="ed-hcard-body">
        <div className="ed-labels">
          <Kicker article={article} />
          {article.premium && <PremiumBadge />}
        </div>
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
        <p className="dek ed-excerpt">{article.dek}</p>
        <Meta article={article} />
      </div>
    </article>
  );
}
