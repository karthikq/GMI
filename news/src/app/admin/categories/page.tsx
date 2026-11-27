import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CategoryManager from "@/components/CategoryManager";
import { Offline, PageSkeleton } from "@/components/States";
import { getAdminCategories } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Categories", robots: { index: false } };

async function CategoriesContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.role !== "admin") {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Categories</h1>
        <p className="form-note error" role="status">
          Category management is only available to admins.
        </p>
      </section>
    );
  }

  const sections = await getAdminCategories();
  if (!sections) return <Offline />;

  return (
    <>
      <header className="page-head">
        <p className="kicker">Admin</p>
        <h1>Categories</h1>
        <p>
          Sections and their subsections — shown on the site as{" "}
          <code>/section</code> and <code>/section/subsection</code>. Deactivating a
          category hides it and its stories without losing them.{" "}
          <Link href="/admin" className="more">
            Newsletter admin →
          </Link>{" "}
          <Link href="/admin/layouts" className="more">
            Section layouts →
          </Link>
        </p>
      </header>
      <CategoryManager sections={sections} />
    </>
  );
}

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CategoriesContent />
    </Suspense>
  );
}
