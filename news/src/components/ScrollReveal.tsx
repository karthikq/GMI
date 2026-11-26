"use client";

import { useEffect } from "react";

// Marks matching elements with data-reveal, then flips it to "visible" when
// they enter the frame. Above-the-fold content is left untouched to avoid a flash.
export default function ScrollReveal({ selector }: { selector: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const settle = (el: HTMLElement) => {
      el.removeAttribute("data-reveal");
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
          el.setAttribute("data-reveal", "visible");
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      const siblings = el.parentElement
        ? Array.from(el.parentElement.children).filter((child) => targets.includes(child as HTMLElement))
        : [el];
      el.style.setProperty("--reveal-delay", `${(siblings.indexOf(el) % 4) * 90}ms`);
      el.setAttribute("data-reveal", "");
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      targets.forEach(settle);
    };
  }, [selector]);

  return null;
}
