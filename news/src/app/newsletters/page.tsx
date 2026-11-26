import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import NewsletterCard from "@/components/NewsletterCard";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { DESK_NEWSLETTERS, FLAGSHIP_NEWSLETTERS } from "@/lib/newsletters";
import { fetchSubscriberFormats, fetchSubscriberLetters, fetchSubscriberTimes } from "@/lib/queries";

export const metadata: Metadata = { title: "Newsletters" };

async function Letters() {
  const user = await getSessionUser();
  const [letterIds, formats, times] = user
    ? await Promise.all([
        fetchSubscriberLetters(user.email),
        fetchSubscriberFormats(user.email),
        fetchSubscriberTimes(user.email),
      ])
    : [[], {} as Record<string, string>, {} as Record<string, string>];
  const subscribed = new Set(letterIds);
  const premium = user?.plan === "premium" || user?.plan === "premium-plus";
  const card = (letter: (typeof FLAGSHIP_NEWSLETTERS)[number]) => (
    <NewsletterCard
      key={letter.id}
      letter={letter}
      subscribed={subscribed.has(letter.id)}
      signedIn={Boolean(user)}
      premium={premium}
      initialFormat={formats[letter.id]}
      initialTime={times[letter.id]}
    />
  );

  return (
    <>
      <header className="page-head">
        <p className="kicker">Newsletters</p>
        <h1>Pick your briefing</h1>
        <p>
          Daily and weekly editions from our desks, straight to your inbox. Flagship
          editions are free for every reader; desk editions come with a paid plan.
        </p>
      </header>

      <div className="letters-grid">{FLAGSHIP_NEWSLETTERS.map(card)}</div>

      <section className="section-block">
        <div className="section-head">
          <h2>Desk editions</h2>
          <Link href="/subscribe" className="more">
            Included with Premium →
          </Link>
        </div>
        <p className="letters-note">
          One weekly dispatch from every newsroom desk — a paid-plan perk. Pick the
          beats you follow.
        </p>
        <div className="letters-grid">{DESK_NEWSLETTERS.map(card)}</div>
      </section>

      {!user && (
        <p className="plans-note">
          Sign in and your picks are saved to your account — you can also manage them from
          your profile.
        </p>
      )}
    </>
  );
}

export default function NewslettersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Letters />
    </Suspense>
  );
}
