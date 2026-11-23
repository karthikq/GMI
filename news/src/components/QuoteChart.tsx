"use client";

import { useState } from "react";
import type { MarketDetail } from "@/lib/api";
import { formatAmount, formatVolume, type MarketRange } from "@/lib/markets";

const W = 800;
const H = 336;
const PAD = { top: 12, right: 12, left: 64 };
const PRICE_H = 230;
const VOL_TOP = 252;
const VOL_H = 56;

const intraday = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const daily = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function QuoteChart({
  points,
  range,
  previousClose,
  showPrevious,
  startLabel,
  endLabel,
}: {
  points: MarketDetail["points"];
  range: MarketRange;
  previousClose: number;
  showPrevious: boolean;
  startLabel: string;
  endLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="chart-empty">No chart data available right now.</p>;

  const innerW = W - PAD.left - PAD.right;
  const values = points.map((p) => p.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * PRICE_H;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const base = PAD.top + PRICE_H;
  const area = `${line} L${x(points.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const color = values.at(-1)! >= values[0] ? "var(--up)" : "var(--live)";

  const volumes = points.map((p) => p.v ?? 0);
  const volMax = Math.max(...volumes);
  const barW = Math.max(1, (innerW / points.length) * 0.7);
  const showPrev = showPrevious && previousClose >= min && previousClose <= max;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((sx - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const hp = hover == null ? null : points[hover];
  const timeFormat = range === "1D" || range === "5D" ? intraday : daily;

  return (
    <div className="quote-chart-wrap">
      <svg
        className="market-chart quote-chart"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${range} price chart, ${formatAmount(values[0])} to ${formatAmount(values.at(-1)!)}`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {[max, (max + min) / 2, min].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="chart-axis">
              {formatAmount(tick)}
            </text>
          </g>
        ))}
        {showPrev && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(previousClose)} y2={y(previousClose)} className="quote-prev" />
            <text x={W - PAD.right} y={y(previousClose) - 6} textAnchor="end" className="chart-axis">
              Previous close {formatAmount(previousClose)}
            </text>
          </>
        )}
        <path d={area} fill={color} fillOpacity={0.12} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {volMax > 0 && (
          <>
            <text x={PAD.left - 8} y={VOL_TOP + VOL_H} textAnchor="end" className="chart-axis">
              Vol
            </text>
            {volumes.map((v, i) => (
              <rect
                key={points[i].t}
                x={x(i) - barW / 2}
                y={VOL_TOP + VOL_H - (v / volMax) * VOL_H}
                width={barW}
                height={(v / volMax) * VOL_H}
                className="quote-vol"
              />
            ))}
          </>
        )}
        {hover != null && hp && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={VOL_TOP + VOL_H} className="quote-cursor" />
            <circle cx={x(hover)} cy={y(hp.c)} r={5} fill={color} className="quote-dot" />
          </>
        )}
        <text x={PAD.left} y={H - 8} className="chart-axis">
          {startLabel}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="chart-axis">
          {endLabel}
        </text>
      </svg>
      {hover != null && hp && (
        <div className="quote-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{formatAmount(hp.c)}</strong>
          <span>{timeFormat.format(hp.t)}</span>
          {hp.v ? <span>Vol: {formatVolume(hp.v)}</span> : null}
        </div>
      )}
    </div>
  );
}
