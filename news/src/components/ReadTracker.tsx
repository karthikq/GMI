"use client";

import { useEffect } from "react";
import { markArticleRead } from "@/app/actions";

// Records one view per browser session per story (the sessionStorage guard also
// stops dev StrictMode double-mounts from counting twice). Signed-in readers
// additionally get a read log entry via the same call.
export default function ReadTracker({ slug, section }: { slug: string; section: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void markArticleRead(slug, section);
  }, [slug, section]);
  return null;
}
