import type { Metadata } from "next";
import { Suspense } from "react";
import MarketGroup from "@/components/MarketGroup";
import SectionRenderer from "@/components/editorial/SectionRenderer";
import SubsectionNav from "@/components/SubsectionNav";
import { Offline, PageSkeleton } from "@/components/States";
import { getMarketViews, getSavedSlugs, getSectionBundle, getSectionTree } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Markets" };

type Props = {
  searchParams: Promise<{ page?: string }>;
};

async function MarketsContent({ searchParams }: Props) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, parseInt(raw ?? "1", 10) || 1);
  const [markets, tree, bundle, user] = await Promise.all([
    getMarketViews(),
    getSectionTree(),
    getSectionBundle({ sectionSlug: "markets", page }),
    getSessionUser(),
  ]);
  if (!markets) return <Offline />;
  const section = tree?.find((item) => item.slug === "markets");
  const slugs = bundle
    ? [
        ...bundle.blocks.flatMap((block) => block.articles.map((article) => article.slug)),
        ...(bundle.feed?.articles.map((article) => article.slug) ?? []),
      ]
    : [];
  const saved = user && slugs.length ? await getSavedSlugs(user.id, slugs) : null;

  return (
    <>
      <header className="page-head">
        <h1>Markets</h1>
        <p>Indices and commodities · daily closes, last three months</p>
        {section?.children?.length ? (
          <SubsectionNav section={section} items={section.children} />
        ) : null}
      </header>
      <MarketGroup title="Indices" markets={markets.filter((m) => !m.commodity)} />
      <MarketGroup title="Commodities" markets={markets.filter((m) => m.commodity)} />
      {bundle && (
        <SectionRenderer
          bundle={bundle}
          page={page}
          basePath="/markets"
          signedIn={Boolean(user)}
          savedSlugs={new Set(saved ?? [])}
        />
      )}
    </>
  );
}


export default function MarketsPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketsContent {...props} />
    </Suspense>
  );
}
