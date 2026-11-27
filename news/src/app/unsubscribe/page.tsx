import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import UnsubscribeForm from "@/components/UnsubscribeForm";
import { PageSkeleton } from "@/components/States";
import { unsubscribeToken } from "@/lib/email";
import { NEWSLETTERS } from "@/lib/newsletters";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

type Props = { searchParams: Promise<{ e?: string; l?: string; t?: string }> };

async function Confirm({ searchParams }: Props) {
  const { e = "", l = "", t = "" } = await searchParams;
  const email = e.trim().toLowerCase();
  const letter = NEWSLETTERS.find((item) => item.id === l) ?? (l ? { id: l, name: l } : null);
  const valid = email && letter && t === unsubscribeToken(email, letter.id);

  if (!valid) {
    return (
      <p className="form-note error" role="alert">
        This unsubscribe link is invalid or has expired. Manage your picks on the{" "}
        <Link href="/newsletters">newsletters page</Link> instead.
      </p>
    );
  }
  return (
    <>
      <p className="form-note">
        Stop <strong>{letter.name}</strong> for <strong>{email}</strong>? Your other
        newsletters are not affected.
      </p>
      <UnsubscribeForm email={email} letter={letter.id} token={t} />
    </>
  );
}

// Signed one-letter unsubscribe target carried in every issue email.
export default function UnsubscribePage({ searchParams }: Props) {
  return (
    <section className="compose">
      <header className="page-head">
        <p className="kicker">Newsletters</p>
        <h1>Unsubscribe</h1>
      </header>
      <Suspense fallback={<PageSkeleton />}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
