import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/States";
import SubscriptionCheckout from "@/components/SubscriptionCheckout";
import { getSessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Checkout" };

async function Checkout({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const planObj = PLANS.find((p) => p.id === plan && p.amount > 0);
  if (!planObj) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  return (
    <>
      <header className="page-head">
        <p className="kicker">Membership</p>
        <h1>{planObj.name} — autopay setup</h1>
        <p>
          {planObj.price} is charged automatically every month through Razorpay.{" "}
          <Link href="/subscribe">Back to plans</Link>
        </p>
      </header>
      <SubscriptionCheckout
        plan={planObj}
        name={user.name}
        email={user.email}
        phone={user.phone}
      />
    </>
  );
}

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Checkout searchParams={searchParams} />
    </Suspense>
  );
}
