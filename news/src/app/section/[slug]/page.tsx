import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
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
  return (
    <>
      <header className="page-head">
        <h1>{section.name}</h1>
        <p>{section.blurb}</p>
      </header>
      {first && <ArticleCard article={first} variant="row" showSection={false} />}
      <div className="grid">
        {rest.map((article) => (
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
