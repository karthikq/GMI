"use client";

import { useEffect } from "react";
import { decodeEmbedHtml, injectEmbedHtml } from "@/lib/embed";

// Finds every raw embed on the page, decodes the stored markup and injects it.
// Provider scripts (X widgets.js, Instagram embed.js, …) are re-created as
// live script elements so they execute and upgrade the markup into cards.
export default function EmbedHydrator() {
  useEffect(() => {
    for (const host of document.querySelectorAll<HTMLElement>("[data-embed-html]")) {
      try {
        injectEmbedHtml(host, decodeEmbedHtml(host.getAttribute("data-embed-html") ?? ""));
        host.removeAttribute("data-embed-html");
      } catch {}
    }
  }, []);
  return null;
}
