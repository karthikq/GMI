import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SendLetterButton from "@/components/SendLetterButton";
import { Offline, PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { fetchSubscriberDashboard, type AdminLetterStatus } from "@/lib/queries";

export const metadata: Metadata = { title: "Subscriber admin", robots: { index: false } };

const STATUS_LABEL: Record<AdminLetterStatus["status"], string> = {
  sent: "Sent",
  confirmed: "Confirmed",
  skipped: "Email off",
  failed: "Failed",
  pending: "Not sent",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const sentFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function letterChip(letter: AdminLetterStatus, email: string) {
  const when = letter.sentAt ? ` · ${sentFormat.format(new Date(letter.sentAt))}` : "";
  return (
    <li key={letter.id}>
      <span className={`send-chip ${letter.status}`} title={letter.cadence}>
        {letter.name}
        <em>
          {STATUS_LABEL[letter.status]}
          {when}
          {letter.time ? ` · ${letter.time}` : ""}
        </em>
        {(letter.status === "pending" || letter.status === "failed") && (
          <SendLetterButton email={email} letter={letter.id} />
        )}
      </span>
    </li>
  );
}

async function AdminContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.role !== "admin") {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Subscriber admin</h1>
        <p className="form-note error" role="status">
          The subscriber dashboard is only available to admins.
        </p>
      </section>
    );
  }

  const subs = await fetchSubscriberDashboard().catch(() => null);
  if (!subs) return <Offline />;

  const letters = subs.flatMap((sub) => sub.letters);
  const totals = {
    subscribers: subs.length,
    letters: letters.length,
    sent: letters.filter((letter) => letter.status === "sent").length,
    pending: letters.filter(
      (letter) => letter.status === "pending" || letter.status === "confirmed",
    ).length,
    failed: letters.filter((letter) => letter.status === "failed").length,
  };

  return (
    <>
      <header className="page-head">
        <p className="kicker">Admin</p>
        <h1>Newsletter subscriptions</h1>
        <p>
          Every address on the list and whether its newsletter issue went out.
          &ldquo;Confirmed&rdquo; means only the subscribe email went out so far;
          &ldquo;Email off&rdquo; means BREVO_API_KEY isn&apos;t configured.
        </p>
      </header>

      <dl className="profile-stats">
        <div>
          <dt>Subscribers</dt>
          <dd>{totals.subscribers}</dd>
        </div>
        <div>
          <dt>Subscriptions</dt>
          <dd>{totals.letters}</dd>
        </div>
        <div>
          <dt>Sent</dt>
          <dd>{totals.sent}</dd>
        </div>
        <div>
          <dt>Not sent</dt>
          <dd>{totals.pending}</dd>
        </div>
        <div>
          <dt>Failed</dt>
          <dd>{totals.failed}</dd>
        </div>
      </dl>

      {subs.length ? (
        <div className="subs-table-wrap">
          <table className="subs-table">
            <thead>
              <tr>
                <th>Subscriber</th>
                <th>Since</th>
                <th>Format</th>
                <th>Newsletters</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => (
                <tr key={sub.email}>
                  <td>
                    <span className="subs-mail">{sub.email}</span>
                    {sub.name && <span className="subs-name">{sub.name}</span>}
                  </td>
                  <td className="subs-since">
                    {sub.subscribedAt ? dateFormat.format(new Date(sub.subscribedAt)) : "—"}
                  </td>
                  <td className="subs-format">{sub.format ?? "Daily Edition"}</td>
                  <td>
                    {sub.letters.length ? (
                      <ul className="subs-letters">
                        {sub.letters.map((letter) => letterChip(letter, sub.email))}
                      </ul>
                    ) : (
                      <span className="subs-name">No newsletters</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="side-note">No subscribers yet.</p>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}
