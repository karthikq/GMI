import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { fetchSectionTree } from "@/lib/queries";

// Every active public section and subsection. `showInNav` only controls the
// header strip, so nav-hidden categories still get a sitemap entry.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
  ];
  try {
    const tree = await fetchSectionTree();
    for (const section of tree) {
      entries.push({
        url: `${base}/${section.slug}`,
        changeFrequency: "hourly",
        priority: 0.8,
      });
      for (const sub of section.children ?? []) {
        entries.push({
          url: `${base}/${section.slug}/${sub.slug}`,
          changeFrequency: "hourly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // An unreachable database shouldn't take the sitemap down with it.
  }
  return entries;
}
