"use server";

import { redirect } from "next/navigation";
import { insertArticle, insertSubscriber, searchArticles as searchArticleDocs } from "@/lib/queries";
import type { ArticleInput } from "@/lib/queries";

export type { ArticleInput };
export type RelatedPick = { slug: string; title: string; sectionName: string };
export type FormState = { ok: boolean; message: string } | null;

export async function subscribe(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const result = await insertSubscriber(formData.get("email"));
    if ("error" in result) {
      return { ok: false, message: result.error };
    }
    return { ok: true, message: "You're subscribed. The first briefing arrives tomorrow." };
  } catch {
    return { ok: false, message: "Can't reach the news server. Try again shortly." };
  }
}

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  // There is no account backend yet, so every attempt is declined politely.
  return {
    ok: false,
    message: "Reader accounts open soon. Until then, the daily briefing is free to everyone.",
  };
}

export async function signInWithProvider(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const provider = formData.get("provider") === "apple" ? "Apple" : "Google";
  // OAuth credentials aren't configured yet, so the attempt is declined politely.
  return {
    ok: false,
    message: `${provider} sign-in isn't connected yet. Until then, the daily briefing is free to everyone.`,
  };
}

export async function signUp(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords don't match." };
  }
  // There is no account backend yet, so every attempt is declined politely.
  return {
    ok: false,
    message: "Reader accounts open soon. Until then, the daily briefing is free to everyone.",
  };
}

export async function searchArticles(query: string): Promise<RelatedPick[]> {
  try {
    return await searchArticleDocs(String(query ?? ""));
  } catch {
    return [];
  }
}

export async function createArticle(input: ArticleInput): Promise<{ message: string } | void> {
  let result: { slug: string; scheduled: boolean };
  try {
    const inserted = await insertArticle(input);
    if ("error" in inserted) {
      return { message: inserted.error };
    }
    result = inserted;
  } catch {
    return { message: "Can't reach the news server. Try again shortly." };
  }
  redirect(`/article/${result.slug}${result.scheduled ? "?scheduled=1" : ""}`);
}
