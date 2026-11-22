import { randomBytes } from "node:crypto";
import type { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { collections, connect } from "./db";

export const SESSION_COOKIE = "gmi_session";
export const OAUTH_STATE_COOKIE = "gmi_oauth_state";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// Defaults to the request's origin so any dev port works; set
// GOOGLE_REDIRECT_URI to pin it (required in Google Cloud console either way).
export function googleRedirectUri(requestUrl: string) {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    new URL("/auth/google/callback", requestUrl).toString()
  );
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: Date;
};

const cookieOptions = (expires?: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  ...(expires ? { expires } : {}),
});

// Sessions are random tokens stored in MongoDB, so they can be revoked and
// expire server-side; the cookie only holds the token.
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    await connect();
    const session = await collections.sessions.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });
    if (!session) return null;
    const user = await collections.users.findOne({ _id: session.userId });
    if (!user) return null;
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.createdAt,
    };
  } catch {
    return null;
  }
}

export async function createSession(userId: ObjectId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await collections.sessions.insertOne({
    token,
    userId,
    createdAt: new Date(),
    expiresAt,
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await connect();
      await collections.sessions.deleteOne({ token });
    } catch {}
  }
  store.delete(SESSION_COOKIE);
}
