import type { Metadata } from "next";
import { Suspense } from "react";
import { choosePlan } from "@/app/actions";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Subscribe" };

async function Plans() {
  const user = await getSessionUser();
  return (
    <>
      <header className="page-head">
        <p className="kicker">Membership</p>
        <h1>Recommended subscription plans</h1>
        <p>Pick the plan that fits how you read. Change or cancel any time.</p>
      </header>
      <div className="plans">
        {PLANS.map((plan) => {
          const current = user?.plan === plan.id;
          return (
            <section key={plan.id} className={`plan${plan.recommended ? " recommended" : ""}`}>
              {plan.recommended && <span className="plan-badge">Recommended</span>}
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
              <form action={choosePlan} className="plan-cta">
                <input type="hidden" name="plan" value={plan.id} />
                <button type="submit" className="button" disabled={current}>
                  {current ? "Current plan" : plan.cta}
                </button>
              </form>
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

export default function SubscribePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Plans />
    </Suspense>
  );
}
