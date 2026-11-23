import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CurrencyToggle from "@/components/CurrencyToggle";
import MarketQuote from "@/components/MarketQuote";
import { Offline, PageSkeleton } from "@/components/States";
import { getMarketDetail, getMarketViews, type MarketDetail, type MarketView } from "@/lib/api";
import { MARKET_RANGES, type MarketRange } from "@/lib/markets";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
};

function MarketList({ title, markets, current }: { title: string; markets: MarketView[]; current: string }) {
  if (!markets.length) return null;
  return (
    <>
      <h2 className="rule-heading">{title}</h2>
      <ul className="markets">
        {markets.map((market) => (
          <li key={market.slug}>
            <Link href={`/markets/${market.slug}`} aria-current={market.slug === current ? "page" : undefined}>
              {market.name}
            </Link>
            <span className="market-value">{market.value}</span>
            <span className={market.change >= 0 ? "market-change up" : "market-change down"}>
              {market.change >= 0 ? "▲" : "▼"} {Math.abs(market.change).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function toRupees(detail: MarketDetail, rate: number): MarketDetail {
  const scale = (n: number | null) => (n == null ? null : n * rate);
  return {
    ...detail,
    currency: "INR",
    price: detail.price * rate,
    delta: detail.delta * rate,
    previousClose: detail.previousClose * rate,
    open: scale(detail.open),
    high: scale(detail.high),
    low: scale(detail.low),
    week52High: scale(detail.week52High),
    week52Low: scale(detail.week52Low),
    points: detail.points.map((p) => ({ ...p, c: p.c * rate })),
  };
}

async function MarketContent({ params, searchParams }: Props) {
  const [{ slug }, { range: raw }] = await Promise.all([params, searchParams]);
  const range = (Object.keys(MARKET_RANGES) as MarketRange[]).find((r) => r === raw) ?? "1D";
  const [markets, detail] = await Promise.all([getMarketViews(), getMarketDetail(slug, range)]);
  if (!markets) return <Offline />;
  if (!markets.some((m) => m.slug === slug)) notFound();
  if (!detail) return <Offline />;

  return (
    <>
      <Link href="/markets" className="more market-back">
        ← All markets
      </Link>
      <div className="market-detail">
        <section>
          {detail.inrRate ? (
            <CurrencyToggle
              usd={<MarketQuote detail={detail} />}
              inr={<MarketQuote detail={toRupees(detail, detail.inrRate)} />}
            />
          ) : (
            <MarketQuote detail={detail} />
          )}
          <p className="side-note">Source: Yahoo Finance. Refreshes every 5 minutes.</p>
        </section>
        <aside>
          <MarketList title="Indices" markets={markets.filter((m) => !m.commodity)} current={slug} />
          <MarketList title="Commodities" markets={markets.filter((m) => m.commodity)} current={slug} />
        </aside>
      </div>
    </>
  );
}

export default function MarketPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketContent {...props} />
    </Suspense>
  );
}
