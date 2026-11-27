import { notFound } from "next/navigation";
import SectionListing from "@/components/SectionListing";
import { Offline } from "@/components/States";
import { getSavedSlugs, getSectionBundle, getSectionTree } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

// Kept for the markets/[slug] fallback that sizes its feed the same way.
export const CATEGORY_PAGE_SIZE = 25;

// Shared body of /[section]/[subsection] and the markets/[slug] fallback —
// resolves the category pair, then renders the configured block program
// scoped to the subsection.
export default async function SubsectionPage({
  sectionSlug,
  subsectionSlug,
  page,
}: {
  sectionSlug: string;
  subsectionSlug: string;
  page: number;
}) {
  const [tree, bundle, user] = await Promise.all([
    getSectionTree(),
    getSectionBundle({ sectionSlug, subsectionSlug, page }),
    getSessionUser(),
  ]);
  if (!tree) return <Offline />;
  const section = tree.find((item) => item.slug === sectionSlug);
  const subsection = section?.children?.find((item) => item.slug === subsectionSlug);
  if (!section || !subsection) notFound();
  if (!bundle) return <Offline />;
  const slugs = [
    ...bundle.blocks.flatMap((block) => block.articles.map((article) => article.slug)),
    ...(bundle.feed?.articles.map((article) => article.slug) ?? []),
  ];
  const saved = user ? await getSavedSlugs(user.id, slugs) : null;
  return (
    <SectionListing
      section={section}
      subsection={subsection}
      items={section.children ?? []}
      bundle={bundle}
      page={page}
      signedIn={Boolean(user)}
      savedSlugs={new Set(saved ?? [])}
    />
  );
}
