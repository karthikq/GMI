"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Section } from "@/lib/api";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// On small screens the whole row scrolls horizontally instead of measuring a
// fit — the same breakpoint where the main nav switches to the drawer.
const SCROLL_WIDTH = "(max-width: 720px)";

export default function SubsectionNav({
  section,
  items,
  activeSlug,
}: {
  section: Section;
  items: Section[];
  activeSlug?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLUListElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [fit, setFit] = useState(items.length);

  // Featured subsections lead the strip; the rest follow in display order.
  // `showInNav` hides a subsection from menus without unpublishing it.
  const ordered = [...items]
    .filter((item) => item.showInNav !== false)
    .sort(
      (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.order ?? 0) - (b.order ?? 0),
    );
  const visible = ordered.slice(0, fit);
  const overflow = ordered.slice(fit);

  // Priority+ fit, same approach as the main nav: measure the hidden copy of
  // the row and show only as many subsections as fit beside the More button.
  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const sizer = sizerRef.current;
    if (!wrap || !sizer) return;

    const scrollable = window.matchMedia(SCROLL_WIDTH);
    const update = () => {
      const all = [...sizer.children] as HTMLElement[];
      // First child is the fixed "All" tab; the rest are measured items.
      const items = all.slice(1);
      if (!all.length) return;
      if (scrollable.matches) {
        setFit(items.length);
        return;
      }
      const gap = parseFloat(getComputedStyle(sizer).columnGap) || 0;
      const moreWidth = moreRef.current?.offsetWidth ?? 64;
      const allWidth = (all[0] as HTMLElement).offsetWidth + gap;
      const prefix = [allWidth];
      items.forEach((item, i) => {
        prefix.push(prefix[i] + item.offsetWidth + gap);
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
    scrollable.addEventListener("change", update);
    document.fonts?.ready.then(update).catch(() => {});
    return () => {
      observer.disconnect();
      scrollable.removeEventListener("change", update);
    };
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const itemLink = (sub: Section, role?: string) => {
    const href = `/${section.slug}/${sub.slug}`;
    return (
      <Link href={href} role={role} aria-current={sub.slug === activeSlug ? "page" : undefined}>
        {sub.name}
      </Link>
    );
  };

  return (
    <nav className="subnav-wrap" ref={wrapRef} aria-label={`${section.name} subsections`}>
      <ul className="subnav-links">
        <li>
          <Link href={`/${section.slug}`} aria-current={!activeSlug ? "page" : undefined}>
            All
          </Link>
        </li>
        {visible.map((sub) => (
          <li key={sub.slug}>{itemLink(sub)}</li>
        ))}
      </ul>
      {/* Hidden copy used only for width measurements — invisible, out of
          flow, and unreachable for keyboard or screen readers. */}
      <ul className="subnav-links subnav-sizer" ref={sizerRef} aria-hidden="true">
        <li>
          <span>All</span>
        </li>
        {ordered.map((sub) => (
          <li key={sub.slug}>
            <span>{sub.name}</span>
          </li>
        ))}
      </ul>
      {overflow.length > 0 && (
        <button
          type="button"
          ref={moreRef}
          className="subnav-more"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
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
          {overflow.map((sub) => (
            <span key={sub.slug} role="none">
              {itemLink(sub, "menuitem")}
            </span>
          ))}
        </div>
      )}
    </nav>
  );
}
