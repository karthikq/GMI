import Link from "next/link";
import { Suspense } from "react";
import { getNavSections } from "@/lib/api";
import SubscribeForm from "./SubscribeForm";

async function FooterSections() {
  const sections = await getNavSections();
  return (
    <ul className="footer-links two">
      {(sections ?? []).map((section) => (
        <li key={section.slug}>
          <Link href={`/${section.slug}`}>{section.name}</Link>
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  return (
    <>
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

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark.png" alt="Good Morning Indian" className="brand-logo" />
            <p>
              An independent daily covering the world, business, technology and culture. All stories
              on this demo site are fictional.
            </p>
          </div>
          <div>
            <h3 className="footer-heading">Sections</h3>
            <Suspense>
              <FooterSections />
            </Suspense>
          </div>
          <div>
            <h3 className="footer-heading">Explore</h3>
            <ul className="footer-links">
              <li>
                <Link href="/">Front page</Link>
              </li>
              <li>
                <Link href="/search">Search the archive</Link>
              </li>
              <li>
                <Link href="/newsletters">All newsletters</Link>
              </li>
              <li>
                <a href="#top">Back to top</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© Good Morning Indian</span>
          <span>Photos: picsum.photos · Market figures are samples · Weather by WeatherAPI.com</span>
        </div>
      </footer>
    </>
  );
}
