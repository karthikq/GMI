"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { Section } from "@/lib/api";

const VISIBLE_COUNT = 8;

export default function NavLinks({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // On the home page, jump to the section's block instead of leaving the page.
  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (pathname !== "/") return;
    const target = document.getElementById(slug);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${slug}`);
  };

  const sectionLink = (section: Section, onNavigate?: () => void) => {
    const href = `/section/${section.slug}`;
    return (
      <Link
        key={section.slug}
        href={href}
        aria-current={pathname === href ? "page" : undefined}
        role={onNavigate ? "menuitem" : undefined}
        onClick={(event) => {
          scrollToSection(event, section.slug);
          onNavigate?.();
        }}
      >
        {section.name}
      </Link>
    );
  };

  const visible = sections.slice(0, VISIBLE_COUNT);
  const overflow = sections.slice(VISIBLE_COUNT);

  return (
    <div className="nav-links-wrap" ref={root}>
      <ul className="nav-links">
        {visible.map((section) => (
          <li key={section.slug}>{sectionLink(section)}</li>
        ))}
      </ul>
      {/* Pinned outside the scrolling list so a crowded nav (e.g. the
          Subscribe button for free readers) can't push it out of view. */}
      {overflow.length > 0 && (
        <button
          type="button"
          className="nav-more"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          More
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path
              d="m6 9 6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {open && overflow.length > 0 && (
        <div className="nav-more-panel" role="menu">
          {overflow.map((section) => sectionLink(section, () => setOpen(false)))}
        </div>
      )}
    </div>
  );
}
