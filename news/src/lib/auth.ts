import { ObjectId } from "mongodb";
import { io } from "next/cache";
import { connection } from "next/server";
import { auth } from "@/auth";
import { collections, connect } from "./db";
import { normalizeRole, type Role } from "./roles";

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
  // Optional public biography, stored under `profile.bio` and surfaced on the
  // reader profile and public author pages.
  bio?: string;
  googleId?: string;
  // False for accounts created through Google — they have no local password.
  hasPassword: boolean;
  passwordChangedAt?: Date;
  createdAt: Date;
  role: Role;
  plan?: string;
  phone?: string;
  // The latest Cashfree mandate started on this account, if any. Read by the
  // subscribe page to re-check statuses that never reached a final state.
  subscription?: { id?: string; cfId?: string; planId?: string; status?: string };
};

// The NextAuth JWT only carries our Mongo user id; profile fields, role and
// plan are read fresh from the users collection on each request.
export async function getSessionUser(): Promise<SessionUser | null> {
  await connection();
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !ObjectId.isValid(id)) return null;
  try {
    await connect();
    await io();
    const user = await collections.users.findOne({ _id: new ObjectId(id) });
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
      bio: typeof user.profile?.bio === "string" ? user.profile.bio : undefined,
      googleId: user.googleId,
      hasPassword: Boolean(user.passwordHash),
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      role: normalizeRole(user.role, user.plan),
      plan: user.plan,
      phone: user.phone,
      subscription: user.subscription,
    };
  } catch {
    return null;
  }
}
