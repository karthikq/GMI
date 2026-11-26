import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleCard, { ArticleImage, Meta } from "@/components/ArticleCard";
import { Offline, PageSkeleton } from "@/components/States";
import { getArticles, getSections } from "@/lib/api";

type Props = { params: Promise<{ slug: string }> };

async function SectionContent({ params }: Props) {
  const { slug } = await params;
  const [sections, result] = await Promise.all([getSections(), getArticles({ section: slug })]);
  if (!sections || !result) return <Offline />;

  const section = sections.find((s) => s.slug === slug);
  if (!section) notFound();

  const [first, ...rest] = result.articles;
  const minis = rest.slice(0, 4);
  const gridArticles = rest.slice(4);
  return (
    <>
      <header className="page-head">
        <h1>{section.name}</h1>
        <p>{section.blurb}</p>
      </header>
      {first && (
        <section className="section-hero">
          <article className="section-lead">
            <Link href={`/article/${first.slug}`} className="card-image" tabIndex={-1} aria-hidden="true">
              <ArticleImage article={first} />
            </Link>
            <div className="card-body">
              <span className="kicker muted">{first.city}</span>
              <h2>
                <Link href={`/article/${first.slug}`}>{first.title}</Link>
              </h2>
              <p className="dek">{first.dek}</p>
              <Meta article={first} />
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
      <div className="grid">
        {gridArticles.map((article) => (
          <ArticleCard key={article.slug} article={article} showSection={false} />
        ))}
      </div>
    </>
  );
}

export default function SectionPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SectionContent params={params} />
    </Suspense>
  );
}
