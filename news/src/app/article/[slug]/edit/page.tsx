import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import ArticleForm from "@/components/ArticleForm";
import { PageSkeleton } from "@/components/States";
import { getEditableArticle, getSectionTree } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isEditorial } from "@/lib/roles";

export const metadata: Metadata = { title: "Edit story", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

async function EditContent({ params }: Props) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!isEditorial(user.role)) notFound();
  // Only the author gets a result here; anyone else sees the not-found page.
  const [article, sections] = await Promise.all([getEditableArticle(slug, user.id), getSectionTree()]);
  if (!article) notFound();
  return <ArticleForm sections={sections ?? []} initial={article} />;
}

export default function EditArticlePage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditContent params={params} />
    </Suspense>
  );
}
