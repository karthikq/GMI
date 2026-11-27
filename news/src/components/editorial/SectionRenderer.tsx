import Link from "next/link";
import type { SectionBundle } from "@/lib/queries";
import SectionBlock from "./SectionBlock";

// The ordered block program of a section/subsection page. The "all" feed is
// rendered last with its own pagination; editorial blocks only show on the
// first page — deeper pages are pure archive, same as before.
export default function SectionRenderer({
  bundle,
  page,
  basePath,
  signedIn,
  savedSlugs,
}: {
  bundle: SectionBundle;
  page: number;
  basePath: string;
  signedIn?: boolean;
  savedSlugs?: ReadonlySet<string>;
}) {
  const feed = bundle.feed;
  const pages = feed ? Math.max(1, Math.ceil(feed.total / feed.block.articleCount)) : 1;

  return (
    <>
      {page === 1 &&
        bundle.blocks.map(({ block, articles, viewAll }) => (
          <SectionBlock
            key={block.id}
            title={block.title}
            viewAll={viewAll}
            layout={block.layout}
            articles={articles}
            signedIn={signedIn}
            savedSlugs={savedSlugs}
          />
        ))}

      {feed && (
        <>
          <SectionBlock
            title={feed.block.title}
            layout={feed.block.layout}
            articles={feed.articles}
            signedIn={signedIn}
            savedSlugs={savedSlugs}
          />
          {!feed.articles.length && page === 1 && !bundle.blocks.length && (
            <div className="notice">
              <h1>No stories yet</h1>
              <p>Nothing has been published under {feed.block.title} so far.</p>
              <Link href={basePath} className="button outline">
                Back to top
              </Link>
            </div>
          )}
          {!feed.articles.length && page > 1 && (
            <div className="notice">
              <h1>That&apos;s everything</h1>
              <p>There are no more stories in this section.</p>
              <Link href={basePath} className="button outline">
                Back to the first page
              </Link>
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
                Page {page} of {pages} · {feed.total} {feed.total === 1 ? "story" : "stories"}
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
      )}
    </>
  );
}
