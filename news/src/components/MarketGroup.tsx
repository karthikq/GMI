import Link from "next/link";
import MarketChart from "@/components/MarketChart";
import type { MarketView } from "@/lib/api";

// A titled grid of market cards — name, value, day change and a sparkline —
// reused by the markets landing page and the dedicated charts view.
export default function MarketGroup({ title, markets }: { title: string; markets: MarketView[] }) {
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
