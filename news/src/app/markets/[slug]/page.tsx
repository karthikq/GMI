import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CurrencyToggle from "@/components/CurrencyToggle";
import MarketQuote from "@/components/MarketQuote";
import SubsectionPage from "@/components/SubsectionPage";
import { Offline, PageSkeleton } from "@/components/States";
import {
  getCategoryPath,
  getMarketDetail,
  getMarketViews,
  type MarketDetail,
  type MarketView,
} from "@/lib/api";
import { MARKET_RANGES, type MarketRange } from "@/lib/markets";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string | string[]; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // A /markets/<slug> URL is a market detail first; when no symbol matches it
  // may still be a Markets subsection (e.g. /markets/commodities).
  const path = await getCategoryPath("markets", slug);
  if (!path?.subsection) return {};
  const { subsection, section } = path;
  const title = subsection.seoTitle ?? `${subsection.name} — ${section.name}`;
  const description =
    subsection.seoDescription ?? subsection.blurb ?? `Latest ${subsection.name} news.`;
  const url = `/${section.slug}/${subsection.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Good Morning Indian" },
  };
}

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
  const [{ slug }, { range: raw, page: rawPage }] = await Promise.all([params, searchParams]);
  const markets = await getMarketViews();
  if (!markets) return <Offline />;
  // Subsection slugs like /markets/commodities land here because the markets
  // routes take precedence over the generic section routes.
  if (!markets.some((m) => m.slug === slug)) {
    const page = Math.max(1, parseInt(String(rawPage ?? "1"), 10) || 1);
    return <SubsectionPage sectionSlug="markets" subsectionSlug={slug} page={page} />;
  }
  const range = (Object.keys(MARKET_RANGES) as MarketRange[]).find((r) => r === raw) ?? "1D";
  const detail = await getMarketDetail(slug, range);
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
