import Link from "next/link";
import { articleHref, Kicker, type CardProps } from "./shared";

// Headline-only card — trending lists, most-read rails and secondary
// headlines. `rank` draws the big ordinal used by most-read blocks.
export default function CompactCard({
  article,
  rank,
}: CardProps & { rank?: number }) {
  const href = articleHref(article);
  return (
    <article className="ed-compact">
      {typeof rank === "number" && <span className="ed-rank">{rank}</span>}
      <div>
        <Kicker article={article} />
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
        <p className="meta">
          <span>{article.ago}</span>
          <span>{article.readMinutes} min read</span>
        </p>
      </div>
    </article>
  );
}
