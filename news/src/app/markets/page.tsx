import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import MarketChart from "@/components/MarketChart";
import { Offline, PageSkeleton } from "@/components/States";
import { getMarketViews, type MarketView } from "@/lib/api";

export const metadata: Metadata = { title: "Markets" };

async function MarketsContent() {
  const markets = await getMarketViews();
  if (!markets) return <Offline />;

  return (
    <>
      <header className="page-head">
        <h1>Markets</h1>
        <p>Indices and commodities · daily closes, last three months</p>
      </header>
      <MarketGroup title="Indices" markets={markets.filter((m) => !m.commodity)} />
      <MarketGroup title="Commodities" markets={markets.filter((m) => m.commodity)} />
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
