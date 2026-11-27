import Link from "next/link";
import { articleHref, initials, type CardProps } from "./shared";

// Columnist card: author credit first, then headline and excerpt — the
// opinion desk's signature layout. Articles carry no author photo, so the
// avatar falls back to initials like the homepage columnist chip.
export default function OpinionCard({ article }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="ed-opinion">
      <div className="columnist">
        <span className="avatar" aria-hidden="true">
          {initials(article.author)}
        </span>
        <div>
          <strong>{article.author}</strong>
          <span>{article.authorRole ?? "Columnist"} · {article.city}</span>
        </div>
      </div>
      <h3>
        <Link href={href}>{article.title}</Link>
      </h3>
      <p className="dek ed-excerpt">{article.dek}</p>
      <p className="meta">
        <span>{article.ago}</span>
        <span>{article.readMinutes} min read</span>
      </p>
    </article>
  );
}
