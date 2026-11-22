import Link from "next/link";
import type { Article } from "@/lib/api";

export function ArticleImage({ article, className }: { article: Article; className?: string }) {
  return (
    // Remote placeholder photos; next/image would need the host allow-listed and gains nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={article.image} alt="" loading="lazy" className={className} />
  );
}

export function Meta({ article }: { article: Article }) {
  return (
    <p className="meta">
      <span>By {article.author}</span>
      <span>{article.ago}</span>
      <span>{article.readMinutes} min read</span>
    </p>
  );
}

type Props = {
  article: Article;
  variant?: "card" | "row" | "brief";
  showSection?: boolean;
};

export default function ArticleCard({ article, variant = "card", showSection = true }: Props) {
  const href = `/article/${article.slug}`;

  if (variant === "brief") {
    return (
      <article className="brief">
        <span className="kicker muted">{article.city}</span>
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
      </article>
    );
  }

  return (
    <article className={variant === "row" ? "card row" : "card"}>
      <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
        <ArticleImage article={article} />
      </Link>
      <div className="card-body">
        {showSection && (
          <Link href={`/section/${article.section}`} className="kicker">
            {article.sectionName}
          </Link>
        )}
        <h3>
          <Link href={href}>{article.title}</Link>
        </h3>
        {variant === "row" && <p className="dek">{article.dek}</p>}
        <Meta article={article} />
      </div>
    </article>
  );
}
