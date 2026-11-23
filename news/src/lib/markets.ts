// Shared by server queries and pages. Keep free of server-only imports.
export const MARKET_SYMBOLS: Record<string, string> = {
  "Nifty 50": "^NSEI",
  Sensex: "^BSESN",
  "S&P 500": "^GSPC",
  "FTSE 100": "^FTSE",
  "Brent crude": "BZ=F",
  Gold: "GC=F",
};

export const COMMODITIES = new Set(["Brent crude", "Gold"]);

export const MARKET_RANGES = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  Max: { range: "max", interval: "1mo" },
};

export type MarketRange = keyof typeof MARKET_RANGES;

export const formatAmount = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
export const formatVolume = (n: number | null) => (n ? compact.format(n) : "—");

export const marketSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
