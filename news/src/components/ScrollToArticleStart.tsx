"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ScrollToArticleStart() {
  const pathname = usePathname();

  useEffect(() => {
    if (!/^\/article\/[^/]+\/?$/.test(pathname)) return;

    const scrollToArticleStart = () => {
      const main = document.getElementById("main");
      if (!main) return window.scrollTo(0, 0);
      window.scrollTo(0, main.getBoundingClientRect().top + window.scrollY);
    };

    scrollToArticleStart();
    const frame = requestAnimationFrame(scrollToArticleStart);
    const timeout = window.setTimeout(scrollToArticleStart, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  return null;
}
