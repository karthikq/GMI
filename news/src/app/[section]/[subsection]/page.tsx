import type { Metadata } from "next";
import { Suspense } from "react";
import SubsectionPage from "@/components/SubsectionPage";
import { PageSkeleton } from "@/components/States";
import { getSectionTree } from "@/lib/api";

type Props = {
  params: Promise<{ section: string; subsection: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: sectionSlug, subsection: subsectionSlug } = await params;
  const tree = await getSectionTree();
  const section = tree?.find((item) => item.slug === sectionSlug);
  const subsection = section?.children?.find((item) => item.slug === subsectionSlug);
  if (!section || !subsection) return {};
  const title = subsection.seoTitle ?? `${subsection.name} — ${section.name}`;
  const description =
    subsection.seoDescription ??
    subsection.blurb ??
    `Latest ${subsection.name} news and analysis.`;
  const url = `/${section.slug}/${subsection.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Good Morning Indian" },
  };
}

async function Content({ params, searchParams }: Props) {
  const [{ section, subsection }, { page: raw }] = await Promise.all([params, searchParams]);
  const page = Math.max(1, parseInt(raw ?? "1", 10) || 1);
  return <SubsectionPage sectionSlug={section} subsectionSlug={subsection} page={page} />;
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
