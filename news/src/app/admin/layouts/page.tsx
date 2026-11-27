import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LayoutManager from "@/components/admin/LayoutManager";
import { Offline, PageSkeleton } from "@/components/States";
import { getSectionTree } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { fetchLayoutDocs } from "@/lib/queries";

export const metadata: Metadata = { title: "Section layouts", robots: { index: false } };

async function LayoutsContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.role !== "admin" && user.role !== "editor") {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Section layouts</h1>
        <p className="form-note error" role="status">
          Layout management is only available to admins and editors.
        </p>
      </section>
    );
  }

  const [tree, docs] = await Promise.all([getSectionTree(), fetchLayoutDocs().catch(() => null)]);
  if (!tree || !docs) return <Offline />;

  return (
    <>
      <header className="page-head">
        <p className="kicker">Admin</p>
        <h1>Section layouts</h1>
        <p>
          Pick a section or subsection and arrange its content blocks — top stories,
          latest, subsection collections and the archive feed.{" "}
          <Link href="/admin/categories" className="more">
            Manage categories →
          </Link>
        </p>
      </header>
      <LayoutManager sections={tree} docs={docs} />
    </>
  );
}

export default function AdminLayoutsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LayoutsContent />
    </Suspense>
  );
}
