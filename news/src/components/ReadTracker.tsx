"use client";

import { useEffect } from "react";
import { markArticleRead } from "@/app/actions";

// Records the read once on mount; the action no-ops for signed-out visitors.
export default function ReadTracker({ slug, section }: { slug: string; section: string }) {
  useEffect(() => {
    void markArticleRead(slug, section);
  }, [slug, section]);
  return null;
}
