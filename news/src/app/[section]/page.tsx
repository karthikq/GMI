import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SectionListing from "@/components/SectionListing";
import { CATEGORY_PAGE_SIZE } from "@/components/SubsectionPage";
import { Offline, PageSkeleton } from "@/components/States";
import { getCategoryArticles, getSectionTree } from "@/lib/api";

type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: slug } = await params;
  const tree = await getSectionTree();
  const section = tree?.find((item) => item.slug === slug);
  if (!section) return {};
  const title = section.seoTitle ?? section.name;
  const description =
    section.seoDescription ?? section.blurb ?? `Latest ${section.name} news and analysis.`;
  return {
    title,
    description,
    alternates: { canonical: `/${section.slug}` },
    openGraph: {
      title,
      description,
      url: `/${section.slug}`,
      type: "website",
      siteName: "Good Morning Indian",
    },
  };
}

async function SectionContent({ params, searchParams }: Props) {
  const [{ section: slug }, { page: raw }] = await Promise.all([params, searchParams]);
  const page = Math.max(1, parseInt(raw ?? "1", 10) || 1);
  const [tree, result] = await Promise.all([
    getSectionTree(),
    getCategoryArticles({
      sectionSlug: slug,
      limit: CATEGORY_PAGE_SIZE,
      offset: (page - 1) * CATEGORY_PAGE_SIZE,
    }),
  ]);
  if (!tree) return <Offline />;
  const section = tree.find((item) => item.slug === slug);
  if (!section) notFound();
  if (!result) return <Offline />;
  return (
    <SectionListing
      section={section}
      items={section.children ?? []}
      articles={result.articles}
      total={result.total}
      page={page}
      perPage={CATEGORY_PAGE_SIZE}
    />
  );
}

export default function SectionPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SectionContent {...props} />
    </Suspense>
  );
}
