"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/Modal";
import SubscriptionCheckout from "@/components/SubscriptionCheckout";
import type { Plan } from "@/lib/plans";

// Paid-plan CTA on the subscribe grid — opens the autopay card in a modal so
// the reader never leaves the plans page.
export default function PlanCheckoutButton({
  plan,
  current,
  name,
  email,
  phone,
}: {
  plan: Plan;
  current: boolean;
  name: string;
  email: string;
  phone?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="plan-cta">
      <button
        type="button"
        className="button"
        disabled={current}
        onClick={() => setOpen(true)}
      >
        {current ? "Current plan" : plan.cta}
      </button>
      {open &&
        createPortal(
          <Modal label={`${plan.name} — autopay setup`} onClose={() => setOpen(false)}>
            <SubscriptionCheckout plan={plan} name={name} email={email} phone={phone} />
          </Modal>,
          document.body,
        )}
    </div>
  );
}
