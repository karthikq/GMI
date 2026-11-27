import Link from "next/link";
import type { DeliveryAttemptDoc, LetterDeliveryDoc, LetterEditionDoc } from "@/lib/db";

function fmt(iso?: Date) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(iso);
}

// Read-only drill-in for one delivery — attempts, edition, provider state.
export default function DeliveryDetail({
  detail,
}: {
  detail: {
    delivery: LetterDeliveryDoc;
    attempts: DeliveryAttemptDoc[];
    edition: LetterEditionDoc | null;
    letterName: string;
  };
}) {
  const { delivery, attempts, edition, letterName } = detail;
  const row = (label: string, value: React.ReactNode) => (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
  return (
    <section className="section-block nc-detail">
      <div className="section-head">
        <h2>Delivery {delivery.email}</h2>
        <Link href="?tab=deliveries" className="more">
          ← Back to list
        </Link>
      </div>
      <div className="subs-table-wrap">
        <table className="subs-table nc-settings">
          <tbody>
            {row("Newsletter", letterName)}
            {row("Recipient", `${delivery.name ? `${delivery.name} ` : ""}<${delivery.email}>`)}
            {row("Edition", edition ? `${edition.editionDate} · ${edition.articleCount} stories` : "—")}
            {row("Format", delivery.format)}
            {row("Status", delivery.status)}
            {row("Scheduled for", fmt(delivery.scheduledAt))}
            {row("Sent", fmt(delivery.sentAt))}
            {row("Delivered", fmt(delivery.deliveredAt))}
            {row("Attempts", delivery.attempts)}
            {row("Provider message", delivery.providerMessageId ?? "—")}
            {row("Provider code", delivery.providerCode ?? "—")}
            {row("Next retry", fmt(delivery.nextRetryAt))}
            {row("Source", delivery.source)}
            {row("Failure reason", delivery.failReason ?? "—")}
            {row("Skip reason", delivery.skipReason ?? "—")}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <h2>Attempt history</h2>
      </div>
      <div className="subs-table-wrap">
        <table className="subs-table">
          <thead>
            <tr>
              <th>At</th>
              <th>By</th>
              <th>Outcome</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={String(attempt._id)}>
                <td>{fmt(attempt.at)}</td>
                <td>{attempt.by}{attempt.userId ? ` (${attempt.userId})` : ""}</td>
                <td>{attempt.outcome}</td>
                <td>{attempt.detail ?? "—"}</td>
              </tr>
            ))}
            {!attempts.length && (
              <tr>
                <td colSpan={4}>No attempts recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
