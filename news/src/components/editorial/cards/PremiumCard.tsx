import Link from "next/link";
import { articleHref, ArticleImage, PremiumBadge, type CardProps } from "./shared";

// Longform/premium card rendered inside the dark premium band. The lock
// badge only appears on stories actually flagged premium — the layout alone
// never marks a story as paid.
export default function PremiumCard({ article }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="ed-premium-card">
      <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
        <ArticleImage article={article} />
      </Link>
      <div className="ed-premium-body">
        <div className="ed-labels">
          <span className="kicker muted">{article.sectionName}</span>
          {article.premium && <PremiumBadge />}
        </div>
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
        <p className="ed-excerpt">{article.dek}</p>
        <p className="meta">
          <span>{article.ago}</span>
          <span>{article.readMinutes} min read</span>
        </p>
      </div>
    </article>
  );
}
