import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { collections, connect } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { claimInvite } from "@/lib/invites";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        await connect();
        const user = await collections.users.findOne({ email });
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
          return null;
        }
        await claimInvite(email);
        return { id: String(user._id), email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Google sign-ins are upserted into our users collection so roles, plans
    // and profile fields live in one place. The Mongo _id becomes user.id.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const googleProfile = (profile ?? {}) as Record<string, unknown>;
      const email = typeof googleProfile.email === "string" ? googleProfile.email : "";
      if (!email || googleProfile.email_verified === false) return false;
      try {
        await connect();
        const result = await collections.users.findOneAndUpdate(
          { email },
          {
            $set: {
              name: (googleProfile.name as string) || email.split("@")[0],
              picture: googleProfile.picture,
              googleId: googleProfile.sub,
            },
            $setOnInsert: {
              email,
              createdAt: new Date(),
              role: "reader",
              ...(googleProfile.given_name ? { firstName: googleProfile.given_name } : {}),
              ...(googleProfile.family_name ? { lastName: googleProfile.family_name } : {}),
            },
          },
          { upsert: true, returnDocument: "after", includeResultMetadata: true },
        );
        const doc = result.value;
        if (!doc) return false;
        user.id = String(doc._id);
        const isNewAccount = result.lastErrorObject?.updatedExisting === false;
        await claimInvite(email);
        if (isNewAccount) {
          try {
            await sendWelcomeEmail(email, doc.name);
          } catch {}
        }
        return true;
      } catch {
        return false;
      }
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
