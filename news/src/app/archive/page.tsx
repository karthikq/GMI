import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import { ARCHIVE_OPTIONS } from "@/lib/archive";
import { Offline, PageSkeleton } from "@/components/States";
import { getArticles } from "@/lib/api";

export const metadata: Metadata = { title: "Archive" };

type Props = { searchParams: Promise<{ days?: string | string[] }> };

const validDays = new Set(ARCHIVE_OPTIONS.map((o) => o.days));

async function Results({ searchParams }: Props) {
  const { days: raw } = await searchParams;
  const days = validDays.has(Number(raw)) ? Number(raw) : 7;
  const label = ARCHIVE_OPTIONS.find((o) => o.days === days)?.label ?? "This week";

  const result = await getArticles({ olderThanDays: days - 7, newerThanDays: days, limit: 30 });
  console.log("Archive result:", result);
  if (!result) return <Offline />;

  return (
    <>
      <header className="page-head">
        <h1>News archive</h1>
        <p>
          {result.total} {result.total === 1 ? "story" : "stories"} · {label}
        </p>
        <nav className="archive-nav" aria-label="Archive range">
          {ARCHIVE_OPTIONS.map((option) => (
            <Link
              key={option.days}
              href={`/archive?days=${option.days}`}
              className={option.days === days ? "archive-nav-current" : undefined}
              aria-current={option.days === days ? "page" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="results">
        {result.articles.map((article) => (
          <ArticleCard key={article.slug} article={article} variant="row" />
        ))}
        {!result.articles.length && <p>No stories in the archive for this range.</p>}
      </div>
    </>
  );
}

export default function ArchivePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Results {...props} />
    </Suspense>
  );
}
