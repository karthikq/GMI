import type { Metadata } from "next";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import { Offline, PageSkeleton } from "@/components/States";
import { getArticles } from "@/lib/api";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

async function Results({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";

  if (!query) {
    return (
      <header className="page-head">
        <h1>Search</h1>
        <p>Type a word or phrase in the search box above.</p>
      </header>
    );
  }

  const result = await getArticles({ q: query, limit: 30 });
  if (!result) return <Offline />;

  return (
    <>
      <header className="page-head">
        <h1>“{query}”</h1>
        <p>
          {result.total} {result.total === 1 ? "story" : "stories"} found
        </p>
      </header>
      <div className="results">
        {result.articles.map((article) => (
          <ArticleCard key={article.slug} article={article} variant="row" />
        ))}
      </div>
    </>
  );
}

export default function SearchPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
