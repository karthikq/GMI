import { awaitReconcile } from "@/lib/cashfree";

// Cashfree redirects the reader here after the mandate screen — as a link
// (GET) or a form post (POST). Either way we verify the subscription status
// server-side rather than trusting the redirect parameters.
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

const PARAMS = [
  "sub",
  "subscription_id",
  "cf_subscriptionId",
  "cf_subscription_id",
  "cf_subReferenceId",
  "sid",
];

async function handle(request: Request) {
  const url = new URL(request.url);
  let sid = PARAMS.map((p) => url.searchParams.get(p)).find((v) => Boolean(v));
  if (!sid && request.method === "POST") {
    try {
      const form = await request.formData();
      sid = PARAMS.map((p) => String(form.get(p) ?? "")).find((v) => Boolean(v)) ?? null;
    } catch {}
  }
  const status = sid ? await awaitReconcile(sid) : "failed";
  // Cashfree's return is a cross-site navigation, so a plain 302 would keep
  // that initiator through the redirect chain and SameSite=Lax cookies would
  // be dropped — the reader would land on /subscribe looking signed out.
  // Serving a page and navigating from it makes the next request same-site.
  const target = `/subscribe?status=${status}`;
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Returning to Good Morning Indian…</title></head><body><script>location.replace(${JSON.stringify(target)})</script><p>Confirming your subscription… <a href="${target}">Continue</a></p></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
