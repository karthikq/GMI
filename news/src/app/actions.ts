"use server";

import { ObjectId } from "mongodb";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn as naSignIn, signOut as naSignOut } from "@/auth";
import { getSessionUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordRules";
import { NO_PHOTO } from "@/lib/avatar";
import { COUNTRIES, INDIAN_STATES } from "@/lib/regions";
import { isHostedImage, signUpload, uploadImage } from "@/lib/cloudinary";
import { collections, connect } from "@/lib/db";
import { deliverLetterNow } from "@/lib/delivery";
import { sendNewsletterConfirmEmail, sendWelcomeEmail } from "@/lib/email";
import { EMAIL_FORMATS, NEWSLETTERS } from "@/lib/newsletters";
import { PLANS } from "@/lib/plans";
import { INVITABLE_ROLES, isEditorial, type Role } from "@/lib/roles";
import {
  cashfreeMode,
  confirmSubscription,
  createCashfreeSubscription,
} from "@/lib/cashfree";
import { recordRead, recordView, toggleBookmark } from "@/lib/reading";
import { sanitizeLayoutInput } from "@/lib/layouts";
import {
  deleteArticle,
  deleteCategory,
  fetchSectionBundle,
  fetchSectionTree,
  insertArticle,
  insertCategory,
  insertSubscriber,
  moveCategory,
  resetLayoutConfig,
  saveLayoutConfig,
  searchArticles as searchArticleDocs,
  setNewsletterSubscription,
  setSubscriberFormat,
  setSubscriberLetterTime,
  setCategoryStatus,
  updateArticle,
  updateCategory,
  type CategoryInput,
} from "@/lib/queries";
import type { ArticleInput } from "@/lib/queries";
import type { Section } from "@/lib/api";

export type { ArticleInput };
export type RelatedPick = { slug: string; title: string; sectionName: string };
export type FormState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
} | null;

export async function subscribe(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  try {
    const result = await insertSubscriber(email, "briefing");
    if ("error" in result) {
      return { ok: false, message: result.error };
    }
    if (result.added) {
      try {
        await sendNewsletterConfirmEmail(email, "briefing");
      } catch {}
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

// Guest sign-up for a single newsletter from its card on /newsletters.
export async function subscribeLetter(_previous: FormState, formData: FormData): Promise<FormState> {
  const letter = String(formData.get("letter") ?? "");
  const found = NEWSLETTERS.find((item) => item.id === letter);
  if (!found) {
    return { ok: false, message: "Pick a newsletter to subscribe to." };
  }
  if (found.premium) {
    return {
      ok: false,
      message: `${found.name} is a Premium edition — sign in and pick a plan to subscribe.`,
    };
  }
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  try {
    const result = await insertSubscriber(email, letter);
    if ("error" in result) {
      return { ok: false, message: result.error };
    }
    if (result.added) {
      try {
        await sendNewsletterConfirmEmail(email, letter);
      } catch {}
    }
    return { ok: true, message: `You're subscribed to ${found.name}.` };
  } catch {
    return {
      ok: false,
      message: "Can't reach the news server. Try again shortly.",
    };
  }
}

// Toggles one newsletter for the signed-in reader, keyed on their email.
export async function setNewsletter(
  letter: string,
  on: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to manage newsletters." };
  const found = NEWSLETTERS.find((item) => item.id === letter);
  // Desk editions are a paid-plan perk; unsubscribing stays free for readers
  // who subscribed before their plan lapsed.
  if (on && found?.premium && user.plan !== "premium" && user.plan !== "premium-plus") {
    return { error: `${found.name} is a Premium edition — upgrade your plan to subscribe.` };
  }
  try {
    const result = await setNewsletterSubscription(user.email, letter, on);
    if ("error" in result) return result;
    if (result.added) {
      if (found) {
        try {
          await sendNewsletterConfirmEmail(user.email, letter);
        } catch {}
      }
    }
    return result;
  } catch {
    return { error: "Couldn't update your newsletters. Try again." };
  }
}

// Picks the reader's preferred email template. Premium formats require a paid
// plan — the same gate is enforced client-side, but this is the real check.
export async function chooseEmailFormat(
  letter: string,
  format: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to choose a format." };
  if (!NEWSLETTERS.some((item) => item.id === letter)) {
    return { error: "Unknown newsletter." };
  }
  const found = EMAIL_FORMATS.find((item) => item.id === format);
  if (!found) return { error: "Unknown format." };
  if (found.premium && user.plan !== "premium" && user.plan !== "premium-plus") {
    return { error: "That's a premium format — upgrade your plan to use it." };
  }
  try {
    const result = await setSubscriberFormat(user.email, letter, format);
    if ("ok" in result) refresh();
    return result;
  } catch {
    return { error: "Couldn't save your format. Try again." };
  }
}

// Saves the reader's preferred delivery time for one newsletter. An empty
// time clears the override so the letter's own cadence stands alone again.
// `timeZone` is the reader's IANA zone, resolved by the browser.
export async function setLetterTime(
  letter: string,
  time: string,
  timeZone?: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to set a delivery time." };
  if (!NEWSLETTERS.some((item) => item.id === letter)) {
    return { error: "Unknown newsletter." };
  }
  const value = String(time ?? "").trim();
  if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return { error: "Pick a valid time." };
  }
  const zone = String(timeZone ?? "").trim();
  try {
    if (zone) new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return await setSubscriberLetterTime(user.email, letter, value || null, zone || undefined);
  } catch {
    return { error: "Couldn't save your time. Try again." };
  }
}

// Saves the reader's chosen plan; signed-out readers go to sign in first.
// Paid plans must go through Cashfree so nobody can grant themselves a paid
// plan by posting this action directly.
export async function choosePlan(formData: FormData): Promise<void> {
  const plan = String(formData.get("plan") ?? "");
  if (!PLANS.some((p) => p.id === plan)) return;
  if (plan !== "free") {
    redirect(`/subscribe/checkout?plan=${encodeURIComponent(plan)}`);
  }
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  await connect();
  const update: Record<string, unknown> = { plan, planSince: new Date() };
  // A paid plan makes a reader a subscriber; editorial roles are untouched.
  if (!isEditorial(user.role)) update.role = plan === "free" ? "reader" : "subscriber";
  await collections.users.updateOne({ _id: new ObjectId(user.id) }, { $set: update });
  redirect("/subscribe");
}

// Starts a Cashfree autopay subscription for a paid plan and returns the
// checkout session id the browser hands to Cashfree's hosted mandate popup.
export async function startSubscription(
  planId: string,
): Promise<{ sessionId: string; subscriptionId: string; mode: string } | { error: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to choose a plan." };
  const plan = PLANS.find((p) => p.id === planId && p.amount > 0);
  if (!plan) return { error: "That plan can't be purchased online." };
  try {
    const { sessionId, subscriptionId } = await createCashfreeSubscription({
      userId: user.id,
      planId: plan.id,
      customer: { name: user.name, email: user.email, phone: user.phone },
    });
    return { sessionId, subscriptionId, mode: cashfreeMode() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Couldn't start the payment. Try again.",
    };
  }
}

// Called after the Cashfree checkout popup closes, to apply the mandate result.
export async function confirmPlan(subscriptionId: string): Promise<{ status: string }> {
  const user = await getSessionUser();
  if (!user) return { status: "failed" };
  try {
    return { status: await confirmSubscription(user.id, subscriptionId) };
  } catch {
    return { status: "pending" };
  }
}

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "", errors: { email: "Enter a valid email address." } };
  }
  try {
    await connect();
    const user = await collections.users.findOne({ email });
    if (!user) {
      return { ok: false, message: "", errors: { email: "No account uses this email yet." } };
    }
    if (!user.passwordHash) {
      return {
        ok: false,
        message: "",
        errors: { email: "This account uses Google sign-in. Continue with Google instead." },
      };
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return { ok: false, message: "", errors: { password: "Incorrect password." } };
    }
  } catch {
    return { ok: false, message: "Can't reach the news server. Try again shortly." };
  }
  // The actual sign-in happens client-side (next-auth/react) so the session
  // cookie is set on a real navigation — a server-action redirect leaves the
  // intercepted sign-in modal mounted.
  return { ok: true, message: "Signing you in…" };
}

export async function signInWithProvider(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  if (formData.get("provider") !== "apple") {
    await naSignIn("google", { redirectTo: "/" });
    return null;
  }
  // Apple sign-in isn't configured yet, so the attempt is declined politely.
  return {
    ok: false,
    message: "Apple sign-in isn't connected yet. Until then, the daily briefing is free to everyone.",
  };
}

export async function signOutUser(): Promise<void> {
  await naSignOut({ redirectTo: "/" });
}

export async function signUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const errors: Record<string, string> = {};
  if (username.length < 2 || username.length > 20) {
    errors.username = "Username must be 2–20 characters.";
  } else if (!/^[A-Za-z0-9_.]+$/.test(username)) {
    errors.username = "Username can only use letters, numbers, dots and underscores.";
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  const weakness = passwordProblem(password);
  if (weakness) {
    errors.password = weakness;
  }
  if (password !== confirm) {
    errors.confirm = "Passwords don't match.";
  }
  if (Object.keys(errors).length) {
    return { ok: false, message: "", errors };
  }
  try {
    await connect();
    await collections.users.insertOne({
      email,
      username,
      name: username,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      role: "reader",
    });
  } catch (error) {
    const dup = (error as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000;
    if (dup) {
      const field = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
      return field && "username" in field
        ? { ok: false, message: "", errors: { username: "That username is taken." } }
        : {
            ok: false,
            message: "",
            errors: { email: "An account with this email already exists. Sign in instead." },
          };
    }
    return {
      ok: false,
      message: "Can't reach the news server. Try again shortly.",
    };
  }
  try {
    await sendWelcomeEmail(email, username);
  } catch {}
  // Client completes the credentials sign-in; see note in signIn.
  return { ok: true, message: "Signing you in…" };
}

// Changes the signed-in reader's password. Accounts created through Google
// have no password stored here, so there's nothing to change.
export async function changePassword(input: {
  current: string;
  next: string;
  confirm: string;
}): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, errors: { form: "Sign in to change your password." } };
  const current = String(input.current ?? "");
  const next = String(input.next ?? "");
  const confirm = String(input.confirm ?? "");

  const errors: Record<string, string> = {};
  if (!current) errors.current = "Enter your current password.";
  const weakness = passwordProblem(next);
  if (weakness) errors.next = weakness;
  if (next !== confirm) errors.confirm = "Passwords don't match.";
  if (!errors.next && current && next === current) {
    errors.next = "Choose a password different from your current one.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  try {
    await connect();
    const _id = new ObjectId(user.id);
    const doc = await collections.users.findOne({ _id }, { projection: { passwordHash: 1 } });
    if (!doc?.passwordHash) {
      return {
        ok: false,
        errors: { form: "Your credentials are managed by your sign-in provider." },
      };
    }
    if (!(await verifyPassword(current, doc.passwordHash))) {
      return { ok: false, errors: { current: "Current password is incorrect." } };
    }
    await collections.users.updateOne(
      { _id },
      { $set: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } },
    );
  } catch {
    return { ok: false, errors: { form: "Couldn't update your password. Try again." } };
  }
  return { ok: true };
}

// Admins invite journalists and editors by email; the role is assigned when
// the invited person next registers or signs in (see claimInvite).
export async function inviteEditorial(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (user?.role !== "admin") {
    return { ok: false, message: "Only admins can send newsroom invitations." };
  }
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!INVITABLE_ROLES.includes(role as Role)) {
    return { ok: false, message: "Choose a valid role." };
  }
  try {
    await collections.invites.updateOne(
      { email },
      {
        $set: {
          role,
          invitedBy: new ObjectId(user.id),
          createdAt: new Date(),
          claimedAt: null,
        },
      },
      { upsert: true },
    );
  } catch {
    return { ok: false, message: "Couldn't save the invitation. Try again." };
  }
  return {
    ok: true,
    message: `${email} will get ${role} access next time they sign in or register.`,
  };
}

// Admin manual send from the subscriber dashboard — fires one issue email
// for an address regardless of its cadence schedule. A "skipped" result means
// Brevo isn't configured, so surface that instead of pretending it went out.
export async function sendLetterNow(
  email: string,
  letter: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can send newsletters." };
  try {
    const result = await deliverLetterNow(String(email ?? ""), String(letter ?? ""));
    if ("error" in result) return result;
    if (result.status === "failed") {
      return { error: "The mail provider rejected the send." };
    }
    if (result.status === "skipped") {
      return { error: "Email is off — BREVO_API_KEY isn't configured." };
    }
    return { ok: true };
  } catch {
    return { error: "Couldn't send the newsletter. Try again." };
  }
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
  try {
    await recordView(slug);
    if (user) await recordRead(new ObjectId(user.id), slug, section);
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
  if (!user || !isEditorial(user.role)) {
    return { message: "Only editorial staff can publish stories." };
  }
  let result: { slug: string; scheduled: boolean };
  try {
    const inserted = await insertArticle(input, user.id);
    if ("error" in inserted) {
      return { message: inserted.error };
    }
    result = inserted;
  } catch {
    return { message: "Can't reach the news server. Try again shortly." };
  }
  revalidatePath("/", "layout");
  redirect(`/article/${result.slug}${result.scheduled ? "?scheduled=1" : ""}`);
}

// Saves edits to a story the signed-in editor wrote. Ownership is checked in the query.
export async function updateStory(slug: string, input: ArticleInput): Promise<{ message: string } | void> {
  const user = await getSessionUser();
  if (!user || !isEditorial(user.role)) return { message: "Only editorial staff can edit stories." };
  const result = await updateArticle(slug, input, user.id);
  if ("error" in result) return { message: result.error };
  revalidatePath("/", "layout");
  redirect(`/article/${result.slug}`);
}

// Deletes a story the signed-in editor wrote, then returns to the front page.
export async function deleteStory(slug: string): Promise<{ message: string } | void> {
  const user = await getSessionUser();
  if (!user || !isEditorial(user.role)) return { message: "Only editorial staff can delete stories." };
  const result = await deleteArticle(slug, user.id);
  if ("error" in result) return { message: result.error };
  revalidatePath("/", "layout");
  redirect("/");
}

// Category management — the /admin/categories dashboard. Admins only, same
// gate as the subscriber dashboard.
export async function createCategory(
  input: CategoryInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can manage categories." };
  try {
    const result = await insertCategory(input);
    if ("error" in result) return result;
    revalidatePath("/", "layout");
    return { ok: true, id: result.id };
  } catch {
    return { error: "Couldn't save the category. Try again." };
  }
}

export async function editCategory(
  id: string,
  input: CategoryInput,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can manage categories." };
  try {
    const result = await updateCategory(id, input);
    if ("ok" in result) revalidatePath("/", "layout");
    return result;
  } catch {
    return { error: "Couldn't update the category. Try again." };
  }
}

export async function reorderCategory(
  id: string,
  direction: -1 | 1,
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can manage categories." };
  try {
    const result = await moveCategory(id, direction);
    if ("ok" in result) revalidatePath("/", "layout");
    return result;
  } catch {
    return { error: "Couldn't reorder categories. Try again." };
  }
}

export async function setCategoryFlags(
  id: string,
  flags: { active?: boolean; showInNav?: boolean; featured?: boolean },
): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can manage categories." };
  try {
    const result = await setCategoryStatus(id, flags);
    if ("ok" in result) revalidatePath("/", "layout");
    return result;
  } catch {
    return { error: "Couldn't update the category. Try again." };
  }
}

export async function removeCategory(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (user?.role !== "admin") return { error: "Only admins can manage categories." };
  try {
    const result = await deleteCategory(id);
    if ("ok" in result) revalidatePath("/", "layout");
    return result;
  } catch {
    return { error: "Couldn't delete the category. Try again." };
  }
}

// Signed params for uploading a story image straight from the browser, so the
// image never travels through the server action body (Next caps it at 4 MB).
export async function signArticleUpload() {
  const user = await getSessionUser();
  if (!isEditorial(user?.role)) return { message: "Only editors can upload story images." };
  return signUpload("gmi/articles") ?? { message: "Photo uploads aren't available right now." };
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
  country?: string;
  state?: string;
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

  if (typeof input.country === "string") {
    const country = input.country.trim();
    if (!COUNTRIES.includes(country)) return { message: "Choose a valid country." };
    update.country = country;

    const state = String(input.state ?? "").trim();
    if (!state) {
      unset.state = "";
    } else if (
      state.length > 80 ||
      (country === "India" && !INDIAN_STATES.includes(state))
    ) {
      return { message: "Choose a valid state." };
    } else {
      update.state = state;
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

// ── Section layout management ──────────────────────────────────────────────
// Admins and editors edit the block program of a section or subsection.

const layoutRole = (role?: string) => role === "admin" || role === "editor";

const cleanSectionSlug = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 80);

// Resolves and validates the target scope against the live category tree.
async function layoutScope(
  sectionSlug: string,
  subsectionSlug: string | null,
): Promise<{ section: Section; subsectionSlug: string | null } | { error: string }> {
  const tree = await fetchSectionTree();
  const section = tree.find((item) => item.slug === sectionSlug);
  if (!section) return { error: "Unknown section." };
  if (subsectionSlug && !section.children?.some((child) => child.slug === subsectionSlug)) {
    return { error: "Unknown subsection." };
  }
  return { section, subsectionSlug };
}

export async function saveSectionLayout(input: {
  sectionSlug: string;
  subsectionSlug?: string | null;
  blocks: unknown;
  collections: unknown;
}): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!layoutRole(user?.role)) {
    return { error: "Only admins and editors can manage layouts." };
  }
  const sectionSlug = cleanSectionSlug(input.sectionSlug);
  const subsectionSlug = input.subsectionSlug ? cleanSectionSlug(input.subsectionSlug) : null;
  const scope = await layoutScope(sectionSlug, subsectionSlug);
  if ("error" in scope) return scope;
  const validSubs = (scope.section.children ?? []).map((child) => child.slug);
  const clean = sanitizeLayoutInput(
    { blocks: input.blocks, collections: input.collections },
    validSubs,
  );
  if ("error" in clean) return clean;
  try {
    const result = await saveLayoutConfig(sectionSlug, subsectionSlug, clean);
    if ("ok" in result) revalidatePath(`/${sectionSlug}`, "page");
    return result;
  } catch {
    return { error: "Couldn't save the layout. Try again." };
  }
}

export async function resetSectionLayout(input: {
  sectionSlug: string;
  subsectionSlug?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const user = await getSessionUser();
  if (!layoutRole(user?.role)) {
    return { error: "Only admins and editors can manage layouts." };
  }
  const sectionSlug = cleanSectionSlug(input.sectionSlug);
  const subsectionSlug = input.subsectionSlug ? cleanSectionSlug(input.subsectionSlug) : null;
  const scope = await layoutScope(sectionSlug, subsectionSlug);
  if ("error" in scope) return scope;
  try {
    const result = await resetLayoutConfig(sectionSlug, subsectionSlug);
    if ("ok" in result) revalidatePath(`/${sectionSlug}`, "page");
    return result;
  } catch {
    return { error: "Couldn't reset the layout. Try again." };
  }
}

// The resolved block program for the admin preview pane — same pipeline the
// public page uses, so what editors see is what readers get.
export async function previewSectionLayout(input: {
  sectionSlug: string;
  subsectionSlug?: string | null;
  blocks?: unknown;
  collections?: unknown;
}): Promise<{ error: string } | Awaited<ReturnType<typeof fetchSectionBundle>>> {
  const user = await getSessionUser();
  if (!layoutRole(user?.role)) return { error: "Only admins and editors can manage layouts." };
  const sectionSlug = cleanSectionSlug(input.sectionSlug);
  const subsectionSlug = input.subsectionSlug ? cleanSectionSlug(input.subsectionSlug) : undefined;
  try {
    // A submitted draft is validated then resolved directly — the preview
    // shows exactly what saving would publish.
    if (input.blocks !== undefined) {
      const scope = await layoutScope(sectionSlug, subsectionSlug ?? null);
      if ("error" in scope) return scope;
      const validSubs = (scope.section.children ?? []).map((child) => child.slug);
      const clean = sanitizeLayoutInput(
        { blocks: input.blocks, collections: input.collections },
        validSubs,
      );
      if ("error" in clean) return clean;
      return await fetchSectionBundle({
        sectionSlug,
        subsectionSlug,
        page: 1,
        config: { sectionSlug, ...(subsectionSlug ? { subsectionSlug } : {}), ...clean },
      });
    }
    return await fetchSectionBundle({ sectionSlug, subsectionSlug, page: 1 });
  } catch {
    return { error: "Couldn't load the preview." };
  }
}
