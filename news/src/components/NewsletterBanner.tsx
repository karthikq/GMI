"use client";

import { usePathname } from "next/navigation";
import SubscribeForm from "./SubscribeForm";

// The Morning Briefing signup band rendered above the footer site-wide —
// hidden on /newsletters itself where the reader is already managing picks.
export default function NewsletterBanner() {
  const pathname = usePathname();
  if (pathname?.startsWith("/newsletters")) return null;

  return (
    <section id="subscribe" className="newsletter">
      <div className="container newsletter-inner">
        <div>
          <span className="kicker">The morning briefing</span>
          <h2>The day, before it starts. In one email.</h2>
          <p>
            Every weekday before 7am: the five stories that matter, the markets at a glance and one
            piece worth your full attention. No ads.
          </p>
        </div>
        <SubscribeForm />
      </div>
    </section>
  );
}
