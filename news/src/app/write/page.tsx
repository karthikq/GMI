import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ArticleForm from "@/components/ArticleForm";
import { getSections } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isEditorial } from "@/lib/roles";

export const metadata: Metadata = { title: "Write a story" };

async function Form() {
  const [sections, user] = await Promise.all([getSections(), getSessionUser()]);

  if (!isEditorial(user?.role)) {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Write a story</h1>
        <p className="form-note error" role="status">
          {user
            ? "Your account doesn't have editorial access, so you can't publish stories."
            : "Sign in with an editorial account to publish stories."}
        </p>
        {!user && (
          <Link href="/signin" className="button">
            Sign in
          </Link>
        )}
      </section>
    );
  }

  if (!sections?.length) {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Write a story</h1>
        <p className="form-note error" role="status">
          Can&apos;t reach the news server, so the desk list is unavailable. Try again shortly.
        </p>
      </section>
    );
  }

  return <ArticleForm sections={sections} />;
}

export default function WritePage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
