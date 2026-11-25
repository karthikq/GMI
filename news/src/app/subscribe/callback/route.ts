import { NextResponse } from "next/server";
import { reconcileSubscription } from "@/lib/razorpay";

// Razorpay redirects the reader here after the mandate screen — as a link
// (GET) or a form post (POST). Either way we verify the subscription status
// server-side rather than trusting the redirect parameters.
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const url = new URL(request.url);
  let sid =
    url.searchParams.get("sid") ??
    url.searchParams.get("razorpay_subscription_id") ??
    url.searchParams.get("subscription_id");
  if (!sid && request.method === "POST") {
    try {
      const form = await request.formData();
      sid =
        String(form.get("razorpay_subscription_id") ?? "") ||
        String(form.get("sid") ?? "") ||
        null;
    } catch {}
  }
  let status = "failed";
  if (sid) {
    try {
      status = await reconcileSubscription(sid);
    } catch {
      status = "pending";
    }
  }
  return NextResponse.redirect(new URL(`/subscribe?status=${status}`, url.origin));
}
