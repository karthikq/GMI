import Link from "next/link";
import ArticleCard, { ArticleImage, Meta } from "@/components/ArticleCard";
import SubsectionNav from "@/components/SubsectionNav";
import type { Article, Section } from "@/lib/api";

type Props = {
  section: Section;
  subsection?: Section;
  items: Section[];
  articles: Article[];
  total: number;
  page: number;
  perPage: number;
};

// BreadcrumbList structured data for the section/subsection page.
function BreadcrumbJsonLd({ section, subsection }: { section: Section; subsection?: Section }) {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: base },
    {
      "@type": "ListItem",
      position: 2,
      name: section.name,
      item: `${base}/${section.slug}`,
    },
  ];
  if (subsection) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: subsection.name,
      item: `${base}/${section.slug}/${subsection.slug}`,
    });
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items }),
      }}
    />
  );
}

// The shared body of every section and subsection page: heading, the
// subsection strip, a featured story rail and the paginated story grid.
export default function SectionListing({ section, subsection, items, articles, total, page, perPage }: Props) {
  const current = subsection ?? section;
  const basePath = `/${section.slug}${subsection ? `/${subsection.slug}` : ""}`;
  const pages = Math.max(1, Math.ceil(total / perPage));

  const [first, ...rest] = articles;
  const hero = page === 1 ? first : undefined;
  const minis = page === 1 ? rest.slice(0, 4) : [];
  const gridArticles = page === 1 ? rest.slice(4) : articles;

  return (
    <>
      <BreadcrumbJsonLd section={section} subsection={subsection} />
      <header className="page-head">
        {subsection && (
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> · <Link href={`/${section.slug}`}>{section.name}</Link> ·{" "}
            <span>{subsection.name}</span>
          </nav>
        )}
        <h1>{current.name}</h1>
        {current.blurb && <p>{current.blurb}</p>}
      </header>
      {items.length > 0 && (
        <SubsectionNav section={section} items={items} activeSlug={subsection?.slug} />
      )}

      {!articles.length && (
        <div className="notice">
          <h1>No stories yet</h1>
          <p>Nothing has been published under {current.name} so far.</p>
          <Link href={`/${section.slug}`} className="button outline">
            Back to {section.name}
          </Link>
        </div>
      )}

      {hero && (
        <section className="section-hero">
          <article className="section-lead">
            <Link href={`/article/${hero.slug}`} className="card-image" tabIndex={-1} aria-hidden="true">
              <ArticleImage article={hero} />
            </Link>
            <div className="card-body">
              <span className="kicker muted">{hero.city}</span>
              <h2>
                <Link href={`/article/${hero.slug}`}>{hero.title}</Link>
              </h2>
              <p className="dek">{hero.dek}</p>
              <Meta article={hero} />
            </div>
          </article>
          {minis.length > 0 && (
            <div className="section-minis">
              {minis.map((article) => (
                <ArticleCard key={article.slug} article={article} variant="mini" showSection={false} />
              ))}
            </div>
          )}
        </section>
      )}

      {gridArticles.length > 0 && (
        <div className="grid">
          {gridArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} showSection={false} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {page > 1 ? (
            <Link href={`${basePath}?page=${page - 1}`} className="button outline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="pager-info">
            Page {page} of {pages} · {total} {total === 1 ? "story" : "stories"}
          </span>
          {page < pages ? (
            <Link href={`${basePath}?page=${page + 1}`} className="button outline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
