import { runSchedulerTick } from "@/lib/deliveryEngine";

// Scheduler entrypoint — call it every minute from any trigger:
//   Hostinger cron:    curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/deliver
//   cron-job.org etc.: same HTTPS GET on a * * * * * schedule
//   Vercel:            vercel.json "crons" entry
// The queue is durable in Mongo; the trigger only controls latency. Running
// it more often is always safe — atomic claims prevent duplicate sends.
// When CRON_SECRET isn't set the endpoint stays open so local dev can tick it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runSchedulerTick("cron");
    if ("error" in result) {
      // A held tick lock is a healthy signal, not a failure.
      return Response.json({ ok: true, busy: result.error });
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Delivery run failed." },
      { status: 500 },
    );
  }
}
