"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Section } from "@/lib/api";

// First paint fallback — the layout effect recomputes the real count from
// available width before the reader notices (useLayoutEffect warns on SSR,
// hence the isomorphic pick).
const INITIAL_COUNT = 8;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function NavLinks({ sections }: { sections: Section[] }) {
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLUListElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Stores the pathname the menu was opened on — a route change closes it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const [fit, setFit] = useState(() => Math.min(INITIAL_COUNT, sections.length));

  const visible = sections.slice(0, fit);
  const overflow = sections.slice(fit);

  // Priority+ nav: measure each section link from a hidden duplicate list and
  // show only as many as fit beside the More button — never a clipped item or
  // a stray gap, no matter how crowded the bar gets (Subscribe button, etc).
  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const sizer = sizerRef.current;
    if (!wrap || !sizer) return;

    const update = () => {
      const items = [...sizer.children] as HTMLElement[];
      if (!items.length) return;
      const gap = parseFloat(getComputedStyle(sizer).columnGap) || 0;
      const moreWidth = moreRef.current?.offsetWidth ?? 64;
      const prefix = [0];
      items.forEach((item, i) => {
        prefix.push(prefix[i] + item.offsetWidth + (i ? gap : 0));
      });
      const available = wrap.clientWidth;
      let count = items.length;
      while (count > 0) {
        const need = prefix[count] + (count < items.length ? gap + moreWidth : 0);
        if (need <= available) break;
        count -= 1;
      }
      setFit(count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    document.fonts?.ready.then(update).catch(() => {});
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpenedOn(null);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const isCurrent = (section: Section) =>
    // A subsection URL keeps its parent section highlighted.
    pathname === `/${section.slug}` || pathname.startsWith(`/${section.slug}/`);

  const sectionLink = (section: Section) => (
    <Link href={`/${section.slug}`} aria-current={isCurrent(section) ? "page" : undefined}>
      {section.name}
    </Link>
  );

  const moreCurrent = overflow.some(isCurrent);

  return (
    <div className="nav-links-wrap" ref={wrapRef}>
      <ul className="nav-links">
        {visible.map((section) => (
          <li key={section.slug}>{sectionLink(section)}</li>
        ))}
      </ul>
      {/* Hidden copy used only for width measurements — invisible, out of
          flow, and unreachable for keyboard or screen readers. */}
      <ul className="nav-links nav-links-sizer" ref={sizerRef} aria-hidden="true">
        {sections.map((section) => (
          <li key={section.slug}>
            <span>{section.name}</span>
          </li>
        ))}
      </ul>
      {/* Pinned outside the scrolling list so a crowded nav (e.g. the
          Subscribe button for free readers) can't push it out of view. */}
      {overflow.length > 0 && (
        <button
          type="button"
          ref={moreRef}
          className="nav-more"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-current={moreCurrent ? "true" : undefined}
          onClick={() => setOpenedOn(open ? null : pathname)}
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
          {overflow.map((section) => (
            <Link
              key={section.slug}
              role="menuitem"
              href={`/${section.slug}`}
              aria-current={isCurrent(section) ? "page" : undefined}
            >
              {section.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
