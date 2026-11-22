import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { ObjectId } from "mongodb";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { collections, connect } from "./db";

export const SESSION_COOKIE = "gmi_session";
export const OAUTH_STATE_COOKIE = "gmi_oauth_state";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// Stored as "salt:hash" (hex).
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Defaults to the request's origin so any dev port works; set
// GOOGLE_REDIRECT_URI to pin it (required in Google Cloud console either way).
export function googleRedirectUri(requestUrl: string) {
  return process.env.GOOGLE_REDIRECT_URI ?? new URL("/auth/google/callback", requestUrl).toString();
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: "male" | "female";
  country?: string;
  state?: string;
  picture?: string;
  avatar?: string;
  createdAt: Date;
  role: "reader" | "editorial";
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
    await io();
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
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      dob: user.dob,
      gender: user.gender,
      country: user.country,
      state: user.state,
      picture: user.picture,
      avatar: user.avatar,
      createdAt: user.createdAt,
      role: user.role === "editorial" ? "editorial" : "reader",
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
