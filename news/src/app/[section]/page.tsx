import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SectionListing from "@/components/SectionListing";
import { Offline, PageSkeleton } from "@/components/States";
import { getSavedSlugs, getSectionBundle, getSectionTree } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

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
  const [tree, bundle, user] = await Promise.all([
    getSectionTree(),
    getSectionBundle({ sectionSlug: slug, page }),
    getSessionUser(),
  ]);
  if (!tree) return <Offline />;
  const section = tree.find((item) => item.slug === slug);
  if (!section) notFound();
  if (!bundle) return <Offline />;
  const slugs = [
    ...bundle.blocks.flatMap((block) => block.articles.map((article) => article.slug)),
    ...(bundle.feed?.articles.map((article) => article.slug) ?? []),
  ];
  const saved = user ? await getSavedSlugs(user.id, slugs) : null;
  return (
    <SectionListing
      section={section}
      items={section.children ?? []}
      bundle={bundle}
      page={page}
      signedIn={Boolean(user)}
      savedSlugs={new Set(saved ?? [])}
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
