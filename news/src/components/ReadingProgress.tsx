"use client";

import { useEffect, useRef } from "react";

export default function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div ref={bar} className="reading-progress" aria-hidden="true" />;
}
