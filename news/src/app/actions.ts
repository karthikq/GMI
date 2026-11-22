"use server";

import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { createSession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { NO_PHOTO } from "@/lib/avatar";
import { isHostedImage, signUpload, uploadImage } from "@/lib/cloudinary";
import { collections, connect } from "@/lib/db";
import { recordRead, toggleBookmark } from "@/lib/reading";
import {
  insertArticle,
  insertSubscriber,
  searchArticles as searchArticleDocs,
} from "@/lib/queries";
import type { ArticleInput } from "@/lib/queries";

export type { ArticleInput };
export type RelatedPick = { slug: string; title: string; sectionName: string };
export type FormState = { ok: boolean; message: string } | null;

export async function subscribe(_previous: FormState, formData: FormData): Promise<FormState> {
  try {
    const result = await insertSubscriber(formData.get("email"));
    if ("error" in result) {
      return { ok: false, message: result.error };
    }
    return {
      ok: true,
      message: "You're subscribed. The first briefing arrives tomorrow.",
    };
  } catch {
    return {
      ok: false,
      message: "Can't reach the news server. Try again shortly.",
    };
  }
}

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  try {
    await connect();
    const user = await collections.users.findOne({ email });
    if (user && !user.passwordHash) {
      return {
        ok: false,
        message: "This account uses Google sign-in. Continue with Google instead.",
      };
    }
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { ok: false, message: "Incorrect email or password." };
    }
    await createSession(user._id);
  } catch {
    return {
      ok: false,
      message: "Can't reach the news server. Try again shortly.",
    };
  }
  redirect("/");
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

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (username.length < 2 || username.length > 20) {
    return { ok: false, message: "Username must be 2–20 characters." };
  }
  if (!/^[A-Za-z0-9_.]+$/.test(username)) {
    return {
      ok: false,
      message: "Username can only use letters, numbers, dots and underscores.",
    };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords don't match." };
  }
  try {
    await connect();
    const { insertedId } = await collections.users.insertOne({
      email,
      username,
      name: username,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      role: "reader",
    });
    await createSession(insertedId);
  } catch (error) {
    const dup = (error as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000;
    if (dup) {
      const field = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
      return field && "username" in field
        ? { ok: false, message: "That username is taken." }
        : {
            ok: false,
            message: "An account with this email already exists. Sign in instead.",
          };
    }
    return {
      ok: false,
      message: "Can't reach the news server. Try again shortly.",
    };
  }
  redirect("/");
}

// Toggles a story in the signed-in reader's saved list. Guests get an error
// so the button can send them to sign-in instead.
export async function toggleSave(
  slug: string,
  section: string,
): Promise<{ saved: boolean } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to save stories." };
  try {
    return {
      saved: await toggleBookmark(new ObjectId(user.id), slug, section),
    };
  } catch {
    return { error: "Couldn't update your saved stories. Try again." };
  }
}

// Logs that the signed-in reader opened a story. No-ops for guests.
export async function markArticleRead(slug: string, section: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  try {
    await recordRead(new ObjectId(user.id), slug, section);
  } catch {}
}

export async function searchArticles(query: string): Promise<RelatedPick[]> {
  try {
    return await searchArticleDocs(String(query ?? ""));
  } catch {
    return [];
  }
}

export async function createArticle(input: ArticleInput): Promise<{ message: string } | void> {
  const user = await getSessionUser();
  if (user?.role !== "editorial") {
    return { message: "Only editorial staff can publish stories." };
  }
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

const AVATAR_FOLDER = "gmi/avatars";

// Signed params for uploading a profile photo straight from the browser.
export async function signAvatarUpload() {
  const user = await getSessionUser();
  if (!user) return { message: "Sign in to edit your profile." };
  return signUpload(AVATAR_FOLDER) ?? { message: "Photo uploads aren't available right now." };
}

// Updates the signed-in reader's display name and profile photo. `avatar`
// is a hosted URL from signAvatarUpload or a data URL for a new upload, an
// empty string to remove a custom photo (falls back to the Google one),
// NO_PHOTO to show the default avatar, or omitted to leave it alone.
export async function updateProfile(input: {
  name?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  avatar?: string;
}): Promise<{ message: string } | void> {
  const user = await getSessionUser();
  if (!user) return { message: "Sign in to edit your profile." };

  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { message: "Your display name needs to be 2–80 characters." };
  }

  const update: Record<string, unknown> = { name };
  const unset: Record<string, ""> = {};

  for (const key of ["firstName", "lastName"] as const) {
    if (typeof input[key] === "string") {
      const value = input[key].trim();
      if (value.length > 80) return { message: "Names can be up to 80 characters." };
      update[key] = value;
    }
  }

  if (typeof input.dob === "string") {
    const dob = input.dob.trim();
    if (!dob) {
      unset.dob = "";
    } else {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        dob < "1900-01-01" ||
        dob > new Date().toISOString().slice(0, 10)
      ) {
        return { message: "Enter a valid date of birth." };
      }
      update.dob = dob;
    }
  }

  if (typeof input.gender === "string") {
    if (!input.gender) {
      unset.gender = "";
    } else if (input.gender === "male" || input.gender === "female") {
      update.gender = input.gender;
    } else {
      return { message: "Choose a valid gender option." };
    }
  }

  if (typeof input.avatar === "string") {
    if (!input.avatar) {
      unset.avatar = "";
    } else if (input.avatar === NO_PHOTO) {
      update.avatar = NO_PHOTO;
    } else if (isHostedImage(input.avatar, AVATAR_FOLDER)) {
      update.avatar = input.avatar;
    } else {
      if (!/^data:image\//.test(input.avatar) || input.avatar.length > 6_000_000) {
        return { message: "Choose an image under ~4 MB." };
      }
      const uploaded = await uploadImage(input.avatar, AVATAR_FOLDER);
      if (!uploaded) return { message: "The photo couldn't be uploaded. Try again." };
      update.avatar = uploaded;
    }
  }

  try {
    await connect();
    await collections.users.updateOne(
      { _id: new ObjectId(user.id) },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    );
  } catch {
    return { message: "Couldn't save your profile. Try again." };
  }
}
