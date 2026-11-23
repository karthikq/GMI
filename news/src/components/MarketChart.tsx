type Props = { points: { t: number; c: number }[]; height?: number; labels?: boolean };

const WIDTH = 800;
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const numberFormat = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// Server-rendered SVG line chart; no client JavaScript needed.
export default function MarketChart({ points, height = 220, labels = false }: Props) {
  if (points.length < 2) return <p className="chart-empty">No chart data available right now.</p>;

  const pad = labels ? { top: 14, right: 14, bottom: 30, left: 70 } : { top: 6, right: 2, bottom: 2, left: 2 };
  const innerW = WIDTH - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = points.map((p) => p.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => pad.top + (1 - (v - min) / span) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const base = pad.top + innerH;
  const area = `${line} L${x(points.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const color = values.at(-1)! >= values[0] ? "var(--up)" : "var(--live)";
  const ticks = labels ? [max, (max + min) / 2, min] : [];

  return (
    <svg
      className="market-chart"
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      role="img"
      aria-label={`Price chart, ${numberFormat(values[0])} to ${numberFormat(values.at(-1)!)}`}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={WIDTH - pad.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
          <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="chart-axis">
            {numberFormat(tick)}
          </text>
        </g>
      ))}
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={labels ? 2.5 : 2} strokeLinejoin="round" />
      {labels && (
        <>
          <text x={pad.left} y={height - 8} className="chart-axis">
            {dayFormat.format(points[0].t)}
          </text>
          <text x={WIDTH - pad.right} y={height - 8} textAnchor="end" className="chart-axis">
            {dayFormat.format(points.at(-1)!.t)}
          </text>
        </>
      )}
    </svg>
  );
}
