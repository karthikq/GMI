import { unsubscribeToken } from "@/lib/email";
import { collections, connect } from "@/lib/db";

// RFC 8058 one-click unsubscribe: mail clients POST here with
// "List-Unsubscribe=One-Click". Parameters match the signed link in every
// issue email; the HMAC token is the credential.
export async function POST(request: Request) {
  let email = "";
  let letter = "";
  let token = "";
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    email = body.e ?? body.email ?? "";
    letter = body.l ?? body.letter ?? "";
    token = body.t ?? body.token ?? "";
  } else {
    const form = await request.formData().catch(() => null);
    email = String(form?.get("e") ?? "");
    letter = String(form?.get("l") ?? "");
    token = String(form?.get("t") ?? "");
  }
  // Query params work too — some clients post to the full link URL.
  const url = new URL(request.url);
  email = (email || url.searchParams.get("e") || "").toLowerCase();
  letter = letter || url.searchParams.get("l") || "";
  token = token || url.searchParams.get("t") || "";

  if (!email || !letter || token !== unsubscribeToken(email, letter)) {
    return Response.json({ error: "Invalid unsubscribe request." }, { status: 400 });
  }
  await connect();
  await collections.subscribers.updateOne({ email }, { $pull: { letters: letter } });
  return Response.json({ ok: true });
}
