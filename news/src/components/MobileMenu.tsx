"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Section } from "@/lib/api";

export default function MobileMenu({
  sections,
  canWrite = false,
}: {
  sections: Section[];
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const toggle = toggleRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // Close if the window grows past the breakpoint where the drawer is hidden.
    const wide = window.matchMedia("(min-width: 901px)");
    const onWide = () => wide.matches && setOpen(false);

    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      toggle?.focus();
    };
  }, [open]);

  // Following any link or submitting the search closes the drawer.
  const closeOnNavigate = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="menu-button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="drawer" data-open={open} inert={!open}>
        <button
          type="button"
          className="drawer-scrim"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
        <aside
          id="mobile-menu"
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={closeOnNavigate}
        >
          <div className="drawer-head">
            <Link href="/" className="drawer-brand">
              <img src="/logo.png" alt="Good Morning Indian" className="brand-logo logo-light" />
              <img src="/logo-dark.png" alt="" aria-hidden="true" className="brand-logo logo-dark" />
            </Link>
            <button
              ref={closeRef}
              type="button"
              className="drawer-close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form action="/search" className="search drawer-search" role="search" onSubmit={() => setOpen(false)}>
            <input type="search" name="q" placeholder="Search stories" aria-label="Search stories" />
            <button type="submit" aria-label="Search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m16.5 16.5 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </form>

          <p className="drawer-label">Sections</p>
          <ul className="drawer-links">
            <li>
              <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
                Front page
              </Link>
            </li>
            {sections.map((section) => {
              const href = `/section/${section.slug}`;
              return (
                <li key={section.slug}>
                  <Link href={href} aria-current={pathname === href ? "page" : undefined}>
                    {section.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="drawer-foot">
            {canWrite && (
              <Link href="/write" className="button outline">
                Write a story
              </Link>
            )}
            <Link href="/profile" className="button outline">
              Profile
            </Link>
            <Link href="/signin" className="button outline">
              Sign in
            </Link>
            <Link href="/subscribe" className="button">
              Subscribe
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
