import Link from "next/link";
import { articleHref, ArticleImage, type CardProps } from "./shared";

// Image-first card for In Pictures, Travel, Entertainment — the headline
// sits as a caption over the photo, with an optional photo count for
// galleries.
export default function VisualCard({ article }: CardProps) {
  const href = articleHref(article);
  return (
    <article className="ed-visual">
      <Link href={href} className="ed-visual-link">
        <ArticleImage article={article} />
        <span className="ed-visual-caption">
          <span className="ed-visual-top">
            <span className="kicker">{article.subsectionName ?? article.sectionName}</span>
            {article.photoCount ? (
              <span className="ed-photo-count">
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                  <path
                    d="M4 7h3l2-3h6l2 3h3v12H4z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                {article.photoCount}
              </span>
            ) : null}
          </span>
          <span className="ed-visual-title">{article.title}</span>
        </span>
      </Link>
    </article>
  );
}
