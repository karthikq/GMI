import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import MarketChart from "@/components/MarketChart";
import SectionRenderer from "@/components/editorial/SectionRenderer";
import SubsectionNav from "@/components/SubsectionNav";
import { Offline, PageSkeleton } from "@/components/States";
import { getMarketViews, getSavedSlugs, getSectionBundle, getSectionTree, type MarketView } from "@/lib/api";
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

function MarketGroup({ title, markets }: { title: string; markets: MarketView[] }) {
  if (!markets.length) return null;
  return (
    <section className="market-group">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="market-grid">
        {markets.map((market) => {
          const up = market.change >= 0;
          return (
            <Link key={market.slug} href={`/markets/${market.slug}`} className="market-card">
              <div className="market-card-head">
                <span className="market-card-name">{market.name}</span>
                <span className={up ? "market-change up" : "market-change down"}>
                  {up ? "▲" : "▼"} {Math.abs(market.change).toFixed(2)}%
                </span>
              </div>
              <strong className="market-card-value">{market.value}</strong>
              <MarketChart points={market.points} height={90} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function MarketsPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketsContent {...props} />
    </Suspense>
  );
}
