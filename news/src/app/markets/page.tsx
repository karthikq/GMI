import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import MarketChart from "@/components/MarketChart";
import SubsectionNav from "@/components/SubsectionNav";
import { Offline, PageSkeleton } from "@/components/States";
import { getCategoryArticles, getMarketViews, getSectionTree, type MarketView } from "@/lib/api";

export const metadata: Metadata = { title: "Markets" };

async function MarketsContent() {
  const [markets, tree, stories] = await Promise.all([
    getMarketViews(),
    getSectionTree(),
    getCategoryArticles({ sectionSlug: "markets", limit: 8 }),
  ]);
  if (!markets) return <Offline />;
  const section = tree?.find((item) => item.slug === "markets");

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
      {stories && stories.articles.length > 0 && (
        <section className="section-block" aria-labelledby="markets-stories">
          <div className="section-head">
            <h2 id="markets-stories">Latest markets stories</h2>
          </div>
          <div className="grid">
            {stories.articles.map((article) => (
              <ArticleCard key={article.slug} article={article} showSection={false} />
            ))}
          </div>
        </section>
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

export default function MarketsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketsContent />
    </Suspense>
  );
}
