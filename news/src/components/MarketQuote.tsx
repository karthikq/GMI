import Link from "next/link";
import QuoteChart from "@/components/QuoteChart";
import type { MarketDetail } from "@/lib/api";
import { formatAmount, formatVolume, MARKET_RANGES, type MarketRange } from "@/lib/markets";

const stamp = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

const axisLabel = (range: MarketRange, t: number) =>
  range === "1D" ? timeFormat.format(t) : range === "5Y" || range === "Max" ? monthFormat.format(t) : dayFormat.format(t);

export default function MarketQuote({ detail }: { detail: MarketDetail }) {
  const { name, slug, symbol, commodity, currency, price, delta, change, previousClose, range, points } = detail;
  const up = change >= 0;
  const stats: [string, string][] = [
    ["Open", formatAmount(detail.open)],
    ["High", formatAmount(detail.high)],
    ["Low", formatAmount(detail.low)],
    ["Volume", formatVolume(detail.volume)],
    ["Previous close", formatAmount(previousClose)],
    ["52-week high", formatAmount(detail.week52High)],
    ["52-week low", formatAmount(detail.week52Low)],
  ];

  return (
    <div className="quote">
      <header className="quote-head">
        <h1>{name}</h1>
        <p className="quote-sub">
          {symbol} · {commodity ? "Commodity" : "Index"}
          {currency && ` · ${currency}`}
        </p>
      </header>
      <div className="quote-price">
        <strong className="quote-value">{formatAmount(price)}</strong>
        {currency && <span className="quote-currency">{currency}</span>}
        <span className={up ? "market-change up" : "market-change down"}>
          {up ? "▲" : "▼"} {formatAmount(Math.abs(delta))} ({Math.abs(change).toFixed(2)}%) today
        </span>
      </div>
      <p className="quote-time">{stamp.format(detail.updated)}</p>
      <nav className="quote-ranges" aria-label="Chart range">
        {(Object.keys(MARKET_RANGES) as MarketRange[]).map((r) => (
          <Link
            key={r}
            href={`/markets/${slug}?range=${r}`}
            className={r === range ? "quote-range current" : "quote-range"}
            aria-current={r === range ? "page" : undefined}
          >
            {r}
          </Link>
        ))}
      </nav>
      <div className="market-chart-frame">
        <QuoteChart
          points={points}
          range={range}
          previousClose={previousClose}
          showPrevious={range === "1D"}
          startLabel={points[0] ? axisLabel(range, points[0].t) : ""}
          endLabel={points.at(-1) ? axisLabel(range, points.at(-1)!.t) : ""}
        />
      </div>
      <dl className="quote-stats">
        {stats.map(([label, text]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
