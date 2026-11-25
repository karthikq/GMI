"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmPlan, startSubscription } from "@/app/actions";
import type { Plan } from "@/lib/plans";

type CashfreeInstance = {
  subscriptionsCheckout: (opts: {
    subsSessionId: string;
    redirectTarget: string;
  }) => Promise<{ error?: { message?: string } }>;
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: string }) => CashfreeInstance;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadCashfreeSdk(): Promise<void> {
  if (typeof window !== "undefined" && window.Cashfree) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't load the payment page."));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

export default function SubscriptionCheckout({
  plan,
  name,
  email,
}: {
  plan: Plan;
  name: string;
  email: string;
  phone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setError("");
    setBusy(true);
    try {
      const result = await startSubscription(plan.id);
      if ("error" in result) {
        setError(result.error);
        setBusy(false);
        return;
      }
      await loadCashfreeSdk();
      const cashfree = window.Cashfree!({ mode: result.mode });
      // _self sends this tab to Cashfree's hosted checkout; on completion it
      // returns through /subscribe/callback, which verifies the mandate and
      // lands on /subscribe?status=…. (_modal silently falls back to a new
      // tab, which would leave this screen hanging on "Connecting…".)
      const out = await cashfree.subscriptionsCheckout({
        subsSessionId: result.sessionId,
        redirectTarget: "_self",
      });
      if (out.error?.message) {
        setError(out.error.message);
        setBusy(false);
        return;
      }
      const done = await confirmPlan(result.subscriptionId);
      router.push(`/subscribe?status=${done.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the payment page.");
      setBusy(false);
    }
  }

  return (
    <div className="checkout-card">
      <div className="checkout-head">
        <div>
          <p className="kicker">Autopay setup</p>
          <h2>{plan.name}</h2>
        </div>
        <p className="checkout-price">
          {plan.price}
          <span>{plan.term}</span>
        </p>
      </div>
      <dl className="checkout-summary">
        <div>
          <dt>Billing</dt>
          <dd>Autopay — UPI, card or eMandate</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>
            {name} ({email})
          </dd>
        </div>
      </dl>
      {error && <p className="form-note error">{error}</p>}
      <button type="button" className="button" onClick={pay} disabled={busy}>
        {busy ? "Connecting…" : `Enable autopay · ${plan.price}/month`}
      </button>
      <p className="form-note">
        You&rsquo;ll be sent to Cashfree&rsquo;s secure checkout to set up the mandate — UPI
        Autopay, card or eMandate — then brought straight back here. The plan amount is debited
        automatically every month; cancel any time.
      </p>
    </div>
  );
}
