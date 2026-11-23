"use client";

import { useState, type ReactNode } from "react";

// Both views are rendered on the server; this only switches which one is shown.
export default function CurrencyToggle({ usd, inr }: { usd: ReactNode; inr: ReactNode }) {
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  return (
    <>
      <div className="currency-toggle" role="group" aria-label="Display currency">
        {(["USD", "INR"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={currency === c}
            className={currency === c ? "current" : undefined}
            onClick={() => setCurrency(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {currency === "USD" ? usd : inr}
    </>
  );
}
