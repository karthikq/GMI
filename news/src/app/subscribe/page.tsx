import type { Metadata } from "next";
import { Suspense } from "react";
import { choosePlan } from "@/app/actions";
import Confetti from "@/components/Confetti";
import PlanCheckoutButton from "@/components/PlanCheckoutButton";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { awaitReconcile } from "@/lib/cashfree";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Subscribe" };

const STATUS_MESSAGES: Record<string, { kind: "ok" | "error"; text: string }> = {
  success: { kind: "ok", text: "You're subscribed — your plan is now active." },
  pending: {
    kind: "ok",
    text: "Your mandate is awaiting bank approval. Your plan activates automatically once it clears.",
  },
  failed: { kind: "error", text: "The payment didn't complete. Nothing was charged — try again." },
  cancelled: { kind: "error", text: "That subscription ended, so your plan was moved back to Free." },
};

// Statuses where the mandate is still in-flight at Cashfree. Anything else
// (ACTIVE / CANCELLED / COMPLETED / EXPIRED) is final and needs no re-check.
const NON_FINAL = new Set(["created", "INITIALIZED", "PENDING", "BANK_APPROVAL_PENDING", ""]);

async function Plans({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [params, sessionUser] = await Promise.all([searchParams, getSessionUser()]);
  let user = sessionUser;
  let { status } = params;

  // A mandate still settling at Cashfree gets re-checked on every page load —
  // the webhook can't reach local dev and bank approvals can lag, so this is
  // the safety net that flips the plan on once Cashfree reports ACTIVE. An
  // ACTIVE mandate whose plan never got written re-checks too.
  const sub = user?.subscription;
  if (
    sub?.id &&
    (NON_FINAL.has(sub.status ?? "") ||
      (sub.status === "ACTIVE" && sub.planId && user?.plan !== sub.planId))
  ) {
    const outcome = await awaitReconcile(sub.id, 2).catch(() => null);
    if (outcome === "success" || outcome === "cancelled") {
      user = await getSessionUser();
      // Upgrade a bare "pending" landing into the real outcome.
      status = outcome;
    }
  }

  const notice = status ? STATUS_MESSAGES[status] : undefined;
  return (
    <>
      {status === "success" && <Confetti />}
      <header className="page-head">
        <p className="kicker">Membership</p>
        <h1>Recommended subscription plans</h1>
        <p>Pick the plan that fits how you read. Change or cancel any time.</p>
        {notice && <p className={`form-note ${notice.kind}`}>{notice.text}</p>}
      </header>
      <div className="plans">
        {PLANS.map((plan) => {
          const current = user?.plan === plan.id;
          return (
            <section
              key={plan.id}
              className={`plan${plan.recommended ? " recommended" : ""}${current ? " current" : ""}`}
            >
              {current ? (
                <span className="plan-badge your-plan">Your plan</span>
              ) : (
                plan.recommended && <span className="plan-badge">Recommended</span>
              )}
              <h2>{plan.name}</h2>
              <p className="plan-price">{plan.price}</p>
              <p className="plan-term">{plan.term}</p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={feature.included ? "on" : "off"}>
                    {feature.text}
                  </li>
                ))}
              </ul>
              {plan.amount > 0 && user ? (
                <PlanCheckoutButton
                  plan={plan}
                  current={current}
                  name={user.name}
                  email={user.email}
                  phone={user.phone}
                />
              ) : (
                <form action={choosePlan} className="plan-cta">
                  <input type="hidden" name="plan" value={plan.id} />
                  <button type="submit" className="button" disabled={current}>
                    {current ? "Current plan" : plan.cta}
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>
      {!user && (
        <p className="plans-note">You&rsquo;ll be asked to sign in before your plan is saved.</p>
      )}
    </>
  );
}

export default function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Plans searchParams={searchParams} />
    </Suspense>
  );
}
