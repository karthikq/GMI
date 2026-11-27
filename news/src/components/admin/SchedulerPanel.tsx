"use client";

import { useState, useTransition } from "react";
import { reconcileDeliveries, runSchedulerNow } from "@/app/actions";
import type { SchedulerRunDoc, SchedulerStateDoc } from "@/lib/db";

function fmt(iso?: Date | string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

// Scheduler & Logs tab: heartbeat, queue depth, run history, run-now and
// reconcile — both buttons call the same durable tick as the cron trigger.
export default function SchedulerPanel({
  status,
}: {
  status: {
    state: SchedulerStateDoc | null;
    queue: Record<string, number>;
    overdue: number;
    runs: SchedulerRunDoc[];
    lastWebhookAt: string | null;
    /** Computed server-side: heartbeat fresher than 3 minutes. */
    alive: boolean;
  };
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const heartbeat = status.state?.heartbeatAt;
  const alive = status.alive;

  const runNow = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await runSchedulerNow();
      if ("error" in result) setError(result.error);
      else setMessage(`Done — ${result.sent} sent, ${result.failed} failed, ${result.queued} queued, ${result.missedMarked} marked missed.`);
    });

  const reconcile = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await reconcileDeliveries();
      if ("error" in result) setError(result.error);
      else setMessage(`Reconciled — ${result.created} expected deliveries verified.`);
    });

  const queue = status.queue;
  const qrow = (label: string, count?: number) => (
    <div>
      <dt>{label}</dt>
      <dd>{count ?? 0}</dd>
    </div>
  );

  return (
    <div>
      <dl className="profile-stats nc-stats">
        <div>
          <dt>Scheduler</dt>
          <dd>
            <span className={`nc-status ${alive ? "nc-delivered" : "nc-failed"}`}>
              {alive ? "RUNNING" : "STALLED"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Heartbeat</dt>
          <dd>{fmt(heartbeat)}</dd>
        </div>
        <div>
          <dt>Last finished</dt>
          <dd>{fmt(status.state?.lastRunFinishedAt)}</dd>
        </div>
        <div>
          <dt>Last status</dt>
          <dd>{status.state?.lastRunStatus ?? "—"}</dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>{status.state?.timeZone ?? "Asia/Kolkata"}</dd>
        </div>
        <div>
          <dt>Last webhook</dt>
          <dd>{fmt(status.lastWebhookAt)}</dd>
        </div>
      </dl>

      <dl className="profile-stats nc-stats">
        {qrow("Scheduled", queue.SCHEDULED)}
        {qrow("Queued", queue.QUEUED)}
        {qrow("Processing", queue.PROCESSING)}
        {qrow("Overdue", status.overdue)}
        {qrow("Missed", queue.MISSED)}
        {qrow("Failed", queue.FAILED)}
        {qrow("Delivered", queue.DELIVERED)}
      </dl>

      <div className="cat-actions" style={{ margin: "14px 0 24px" }}>
        <button type="button" className="button" onClick={runNow} disabled={pending}>
          {pending ? "Running…" : "Run scheduler now"}
        </button>
        <button type="button" className="button outline" onClick={reconcile} disabled={pending}>
          {pending ? "Working…" : "Reconcile deliveries"}
        </button>
      </div>
      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-note ok" role="status">
          {message}
        </p>
      )}

      <section className="section-block">
        <div className="section-head">
          <h2>Recent runs</h2>
        </div>
        <div className="subs-table-wrap">
          <table className="subs-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Trigger</th>
                <th>Worker</th>
                <th>Planned</th>
                <th>Claimed</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Missed</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {status.runs.map((run) => (
                <tr key={String(run._id)}>
                  <td>{fmt(run.startedAt)}</td>
                  <td>{run.trigger}</td>
                  <td className="nc-reason">{run.workerId}</td>
                  <td>{run.plannedEditions}</td>
                  <td>{run.claimed}</td>
                  <td>{run.sent}</td>
                  <td>{run.failed}</td>
                  <td>{run.missedMarked}</td>
                  <td className="nc-reason">{run.errors.slice(0, 2).join(" · ") || "—"}</td>
                </tr>
              ))}
              {!status.runs.length && (
                <tr>
                  <td colSpan={9}>No runs recorded — the cron trigger has not fired yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
