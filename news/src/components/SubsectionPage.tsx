import { notFound } from "next/navigation";
import SectionListing from "@/components/SectionListing";
import { Offline } from "@/components/States";
import { getCategoryArticles, getSectionTree } from "@/lib/api";

export const CATEGORY_PAGE_SIZE = 25;

// Shared body of /[section]/[subsection] and the markets/[slug] fallback —
// resolves the category pair, then renders the standard listing.
export default async function SubsectionPage({
  sectionSlug,
  subsectionSlug,
  page,
}: {
  sectionSlug: string;
  subsectionSlug: string;
  page: number;
}) {
  const [tree, result] = await Promise.all([
    getSectionTree(),
    getCategoryArticles({
      sectionSlug,
      subsectionSlug,
      limit: CATEGORY_PAGE_SIZE,
      offset: (page - 1) * CATEGORY_PAGE_SIZE,
    }),
  ]);
  if (!tree) return <Offline />;
  const section = tree.find((item) => item.slug === sectionSlug);
  const subsection = section?.children?.find((item) => item.slug === subsectionSlug);
  if (!section || !subsection) notFound();
  if (!result) return <Offline />;
  return (
    <SectionListing
      section={section}
      subsection={subsection}
      items={section.children ?? []}
      articles={result.articles}
      total={result.total}
      page={page}
      perPage={CATEGORY_PAGE_SIZE}
    />
  );
}
