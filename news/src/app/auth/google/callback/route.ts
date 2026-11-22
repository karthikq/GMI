import { NextResponse, type NextRequest } from "next/server";
import { createSession, googleRedirectUri, OAUTH_STATE_COOKIE } from "@/lib/auth";
import { collections, connect } from "@/lib/db";

export async function GET(request: NextRequest) {
  const fail = () =>
    NextResponse.redirect(new URL("/signin?error=google", request.url));
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return fail();
  const code = params.get("code");
  const state = params.get("state");
  if (!code || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) {
    return fail();
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(request.url),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail();
  const { access_token: accessToken } = await tokenRes.json();
  if (!accessToken) return fail();

  const profileRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!profileRes.ok) return fail();
  const profile = await profileRes.json();
  if (!profile?.email || profile.email_verified === false) return fail();

  let response: NextResponse;
  try {
    await connect();
    const user = await collections.users.findOneAndUpdate(
      { email: profile.email },
      {
        $set: {
          name: profile.name || profile.email.split("@")[0],
          picture: profile.picture,
          googleId: profile.sub,
        },
        $setOnInsert: {
          email: profile.email,
          createdAt: new Date(),
          role: "reader",
          ...(profile.given_name ? { firstName: profile.given_name } : {}),
          ...(profile.family_name ? { lastName: profile.family_name } : {}),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!user) return fail();
    await createSession(user._id);
    response = NextResponse.redirect(new URL("/", request.url));
  } catch {
    return fail();
  }

  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
