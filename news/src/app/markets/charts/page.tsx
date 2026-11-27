import type { Metadata } from "next";
import { Suspense } from "react";
import MarketGroup from "@/components/MarketGroup";
import { Offline, PageSkeleton } from "@/components/States";
import { getMarketViews } from "@/lib/api";

export const metadata: Metadata = {
  title: "Market charts",
  description: "Index and commodity charts — daily closes over the last three months.",
};

async function Charts() {
  const markets = await getMarketViews();
  if (!markets) return <Offline />;
  return (
    <>
      <header className="page-head">
        <p className="kicker">Markets</p>
        <h1>Charts</h1>
        <p>Indices and commodities · daily closes, last three months</p>
      </header>
      <MarketGroup title="Indices" markets={markets.filter((m) => !m.commodity)} />
      <MarketGroup title="Commodities" markets={markets.filter((m) => m.commodity)} />
    </>
  );
}

export default function MarketChartsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Charts />
    </Suspense>
  );
}
