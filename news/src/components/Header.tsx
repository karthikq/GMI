import Link from "next/link";
import { Suspense } from "react";
import { getEdition, getMarkets, getSections, getTicker } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { profileImage } from "@/lib/avatar";
import { marketSlug } from "@/lib/markets";
import { PLANS } from "@/lib/plans";
import { isEditorial } from "@/lib/roles";
import AccountMenu from "./AccountMenu";
import LiveWeather from "./LiveWeather";
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
      <LiveWeather fallback={edition.weather} />
      <span>
        {edition.market.name} {edition.market.value}{" "}
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

async function NavAccount() {
  const user = await getSessionUser();
  const plan = PLANS.find((p) => p.id === user?.plan) ?? PLANS[0];
  return (
    <AccountMenu
      name={user?.name}
      email={user?.email}
      image={user ? profileImage(user) : undefined}
      variant="nav"
      plan={
        user
          ? {
              name: plan.name,
              price: plan.price,
              term: plan.term,
              paid: plan.amount > 0,
              status: user.subscription?.status,
            }
          : undefined
      }
    />
  );
}

const isPaidPlan = (plan?: string) => !!plan && plan !== "free";

async function SubscribeLink() {
  const user = await getSessionUser();
  if (isPaidPlan(user?.plan)) return null;
  return (
    <Link href="/subscribe" className="button">
      Subscribe
    </Link>
  );
}

async function EditorialLink() {
  const user = await getSessionUser();
  if (!isEditorial(user?.role)) return null;
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
  return (
    <MobileMenu
      sections={sections ?? []}
      canWrite={isEditorial(user?.role)}
      signedIn={!!user}
      subscribed={isPaidPlan(user?.plan)}
    />
  );
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

async function Markets() {
  const markets = await getMarkets();
 
  
  if (!markets?.length) return null;
  // The list is rendered twice so the scroll loops without a gap.
  const loop = [...markets, ...markets];
  return (
    <div className="ticker ticker-markets">
      <div className="container ticker-inner">
        <Link href="/markets" className="ticker-label">
          Markets
        </Link>
        <div className="ticker-window">
          <ul className="ticker-track">
            {loop.map((market, index) => (
              <li key={index} aria-hidden={index >= markets.length}>
                <Link
                  href={`/markets/${marketSlug(market.name)}`}
                  className="market-link"
                  tabIndex={index >= markets.length ? -1 : 0}
                >
                  {market.name}
                  <span className="market-value">{market.value}</span>
                  <span className={market.change >= 0 ? "market-change up" : "market-change down"}>
                    {market.change >= 0 ? "▲" : "▼"} {Math.abs(market.change).toFixed(2)}%
                  </span>
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
                <Link href="/newsletters">Newsletters</Link>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Good Morning Indian" className="brand-logo logo-light" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <Suspense>
              <SubscribeLink />
            </Suspense>
            <Suspense>
              <NavAccount />
            </Suspense>
          </div>
        </div>
      </nav>

      <Suspense>
        <Ticker />
      </Suspense>
      <Suspense>
        <Markets />
      </Suspense>
    </>
  );
}
