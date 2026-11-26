import Link from "next/link";
import type { Article } from "@/lib/api";

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short" });

const acrossDate = (value: string) => {
  const date = new Date(value);
  return `${monthFormat.format(date).toUpperCase()} ${date.getDate()}`;
};

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
  variant?: "card" | "row" | "brief" | "mini" | "across";
  showSection?: boolean;
};

export default function ArticleCard({ article, variant = "card", showSection = true }: Props) {
  const href = `/article/${article.slug}`;

  if (variant === "mini") {
    return (
      <article className="mini">
        <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
          <ArticleImage article={article} />
        </Link>
        <div className="mini-body">
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

  if (variant === "across") {
    return (
      <article className="card across-card">
        <Link href={href} className="card-image" tabIndex={-1} aria-hidden="true">
          <ArticleImage article={article} />
        </Link>
        <div className="across-body">
          <div className="across-meta">
            <Link href={`/${article.section}`} className="across-section">
              {article.sectionName}
            </Link>
            <time dateTime={article.publishedAt}>{acrossDate(article.publishedAt)}</time>
          </div>
          <h3>
            <Link href={href}>{article.title}</Link>
          </h3>
          <p className="across-dek">{article.dek}</p>
          <p className="across-byline">
            By {article.author} <span aria-hidden="true">·</span> {article.readMinutes} min
          </p>
        </div>
      </article>
    );
  }

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
          <Link href={`/${article.section}`} className="kicker">
            {article.subsectionName ?? article.sectionName}
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
