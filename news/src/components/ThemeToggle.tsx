"use client";

import { useSyncExternalStore, type MouseEvent } from "react";

// The active theme lives on <html data-theme>, set by the inline script in
// the root layout. A MutationObserver keeps the label in sync with it.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const ANIMATION_MS = 450;

type ViewTransition = { ready: Promise<void> };

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = document.documentElement.dataset.theme !== "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next ? "dark" : "light";
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {}
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    const startViewTransition = (
      document as Document & {
        startViewTransition?: (callback: () => void) => ViewTransition;
      }
    ).startViewTransition;

    // Circular reveal expanding from the click point (or the button's
    // centre when activated by keyboard, which reports 0,0).
    if (startViewTransition) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX || rect.left + rect.width / 2;
      const y = event.clientY || rect.top + rect.height / 2;
      const transition = startViewTransition.call(document, apply);
      transition.ready
        .then(() => {
          const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
          );
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: ANIMATION_MS,
              easing: "ease-in-out",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});
      return;
    }

    // Fallback: briefly enable colour transitions, then swap the theme.
    document.documentElement.classList.add("theme-animating");
    apply();
    window.setTimeout(() => {
      document.documentElement.classList.remove("theme-animating");
    }, ANIMATION_MS);
  };

  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      <svg className="icon-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="icon-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
