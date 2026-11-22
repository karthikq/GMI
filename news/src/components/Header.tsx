import Link from "next/link";
import { Suspense } from "react";
import { getEdition, getSections, getTicker } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { profileImage } from "@/lib/avatar";
import AccountMenu from "./AccountMenu";
import MobileMenu from "./MobileMenu";
import NavLinks from "./NavLinks";
import ThemeToggle from "./ThemeToggle";

async function EditionLeft() {
  const edition = await getEdition();
  if (!edition) return null;
  return (
    <>
      <strong>{edition.name}</strong>
      <span>{edition.date}</span>
      <span>
        Updated {edition.updated} · {edition.stories} stories
      </span>
    </>
  );
}

async function EditionRight() {
  const edition = await getEdition();
  if (!edition) return null;
  const up = edition.market.change >= 0;
  return (
    <>
      {edition.weather && (
        <>
          <strong>
            {edition.weather.city} · {edition.weather.temperature}
          </strong>
          <span>{edition.weather.summary}</span>
        </>
      )}
      <span>
        {edition.market.name}{" "}
        <b className={up ? "up" : "down"}>
          {up ? "▲" : "▼"} {Math.abs(edition.market.change)}%
        </b>
      </span>
    </>
  );
}

function SignInLink() {
  return (
    <Link href="/signin" className="topbar-signin">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Sign in
    </Link>
  );
}

async function AccountLink() {
  const user = await getSessionUser();
  if (!user) return <SignInLink />;
  return (
    <AccountMenu
      name={user.name}
      email={user.email}
      image={profileImage(user)}
      variant="topbar"
    />
  );
}

async function NavAvatar() {
  const user = await getSessionUser();
  if (!user) return null;
  return (
    <AccountMenu
      name={user.name}
      email={user.email}
      image={profileImage(user)}
      variant="nav"
    />
  );
}

async function EditorialLink() {
  const user = await getSessionUser();
  if (user?.role !== "editorial") return null;
  return (
    <li>
      <Link href="/write">Write a story</Link>
    </li>
  );
}

async function Sections() {
  const sections = await getSections();
  return <NavLinks sections={sections ?? []} />;
}

async function MobileNav() {
  const [sections, user] = await Promise.all([getSections(), getSessionUser()]);
  return <MobileMenu sections={sections ?? []} canWrite={user?.role === "editorial"} />;
}

async function Ticker() {
  const items = await getTicker();
  if (!items?.length) return null;
  // The list is rendered twice so the scroll loops without a gap.
  const loop = [...items, ...items];
  return (
    <div className="ticker">
      <div className="container ticker-inner">
        <span className="ticker-label">
          <i aria-hidden="true" /> Live
        </span>
        <div className="ticker-window">
          <ul className="ticker-track">
            {loop.map((item, index) => (
              <li key={index} aria-hidden={index >= items.length}>
                <time>{item.time}</time>
                <Link href={`/article/${item.slug}`} tabIndex={index >= items.length ? -1 : 0}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  return (
    <>
      <header>
        <div className="topbar">
          <div className="container topbar-inner">
            <ul className="topbar-links">
              <li>
                <Link href="/">Today&apos;s edition</Link>
              </li>
              <li>
                <a href="#subscribe">Newsletters</a>
              </li>
              <li>
                <Link href="/search">Search the archive</Link>
              </li>
              <li>
                <Link href="/profile">Your profile</Link>
              </li>
              <Suspense>
                <EditorialLink />
              </Suspense>
            </ul>
            <Suspense fallback={<SignInLink />}>
              <AccountLink />
            </Suspense>
          </div>
        </div>

        <div className="container masthead">
          <div className="masthead-meta">
            <Suspense>
              <EditionLeft />
            </Suspense>
          </div>
          <Link href="/" className="brand" aria-label="Good Morning Indian, home">
            <img src="/logo.png" alt="Good Morning Indian" className="brand-logo logo-light" />
            <img src="/logo-dark.png" alt="" aria-hidden="true" className="brand-logo logo-dark" />
            <span className="brand-tag">World · Business · Culture · Reported with care</span>
          </Link>
          <div className="masthead-meta right">
            <Suspense>
              <EditionRight />
            </Suspense>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="Sections">
        <div className="container nav-inner">
          <Suspense fallback={<ul className="nav-links" />}>
            <Sections />
          </Suspense>
          <div className="nav-actions">
            <Suspense>
              <MobileNav />
            </Suspense>
            <form action="/search" className="search" role="search">
              <input type="search" name="q" placeholder="Search" aria-label="Search stories" />
              <button type="submit" aria-label="Search">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            <ThemeToggle />
            <a href="#subscribe" className="button">
              Subscribe
            </a>
            <Suspense>
              <NavAvatar />
            </Suspense>
          </div>
        </div>
      </nav>

      <Suspense>
        <Ticker />
      </Suspense>
    </>
  );
}
