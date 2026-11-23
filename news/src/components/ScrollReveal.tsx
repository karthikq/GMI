"use client";

import { useEffect } from "react";

// Fades and slides elements matching `selector` in as they scroll into view.
// Elements already on screen when the page loads are left alone so nothing
// above the fold flashes.
export default function ScrollReveal({ selector }: { selector: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const settle = (el: HTMLElement) => {
      el.classList.remove("reveal", "is-in");
      el.style.removeProperty("--reveal-delay");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          const done = (event: TransitionEvent) => {
            if (event.target !== el || event.propertyName !== "transform") return;
            el.removeEventListener("transitionend", done);
            settle(el);
          };
          el.addEventListener("transitionend", done);
          el.classList.add("is-in");
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children).filter((child) => targets.includes(child as HTMLElement))
        : [el];
      el.style.setProperty("--reveal-delay", `${(siblings.indexOf(el) % 4) * 90}ms`);
      el.classList.add("reveal");
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      targets.forEach(settle);
    };
  }, [selector]);

  return null;
}
