import { deliverDueNewsletters } from "@/lib/delivery";

// Delivery cron entrypoint. Vercel Cron hits this on the vercel.json schedule;
// any external scheduler (system cron, cron-job.org) can call it the same way:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/deliver
// When CRON_SECRET isn't set the endpoint stays open so local dev can trigger
// it by hand — it still no-ops sends without BREVO_API_KEY.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const run = await deliverDueNewsletters();
    return Response.json({ ok: true, ...run });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Delivery run failed." },
      { status: 500 },
    );
  }
}
