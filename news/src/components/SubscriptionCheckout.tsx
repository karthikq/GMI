"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmPlan, startSubscription } from "@/app/actions";
import type { Plan } from "@/lib/plans";

type RazorpayInstance = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

let sdkPromise: Promise<void> | null = null;
function loadRazorpaySdk(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
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
  phone,
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
        return;
      }
      await loadRazorpaySdk();
      const razorpay = new window.Razorpay!({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "Good Morning Indian",
        description: `${plan.name} — ${plan.price}/month`,
        prefill: { name, email, ...(phone ? { contact: phone } : {}) },
        notes: { site_plan: plan.id },
        theme: { color: "#b5002d" },
        // Runs once the reader authorises the mandate in the popup.
        handler: async (response: { razorpay_subscription_id?: string }) => {
          const subId = response.razorpay_subscription_id ?? result.subscriptionId;
          const out = await confirmPlan(subId);
          router.push(`/subscribe?status=${out.status}`);
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the payment page.");
      setBusy(false);
    }
    // busy clears via the checkout handler or modal.ondismiss.
  }

  return (
    <div className="checkout-card">
      <dl className="checkout-summary">
        <div>
          <dt>Plan</dt>
          <dd>{plan.name}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>
            {plan.price} {plan.term.toLowerCase()}
          </dd>
        </div>
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
        Razorpay&rsquo;s secure popup sets up the mandate and collects your payment details — UPI
        Autopay, card or eMandate. The plan amount is then debited automatically every month; cancel
        any time.
      </p>
    </div>
  );
}
