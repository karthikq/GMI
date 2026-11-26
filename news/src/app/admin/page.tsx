import type { Metadata } from "next";
import Link from "next/link";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SendLetterButton from "@/components/SendLetterButton";
import { Offline, PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import {
  fetchDailyDeliveries,
  fetchDeliveriesForDay,
  fetchSubscriberDashboard,
  type AdminLetterStatus,
} from "@/lib/queries";

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
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
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
          {letter.formatName ? ` · ${letter.formatName}` : ""}
        </em>
        {(letter.status === "pending" || letter.status === "failed") && (
          <SendLetterButton email={email} letter={letter.id} />
        )}
      </span>
    </li>
  );
}

async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const params = await searchParams;
  await io();
  const day =
    typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day)
      ? params.day
      : new Date().toISOString().slice(0, 10);
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

  const [subs, daily, dayRows] = await Promise.all([
    fetchSubscriberDashboard().catch(() => null),
    fetchDailyDeliveries().catch(() => [] as Awaited<ReturnType<typeof fetchDailyDeliveries>>),
    fetchDeliveriesForDay(day).catch(() => [] as Awaited<ReturnType<typeof fetchDeliveriesForDay>>),
  ]);
  if (!subs) return <Offline />;

  const maxDay = Math.max(1, ...daily.map((day) => day.sent + day.failed + day.skipped));
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
          &ldquo;Email off&rdquo; means BREVO_API_KEY isn&apos;t configured.{" "}
          <Link href="/admin/categories" className="more">
            Manage categories →
          </Link>
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
      <section className="section-block" aria-label="Email deliveries per day">
        <div className="section-head">
          <h2>Emails sent — last 14 days</h2>
        </div>
        <div className="dash-bars">
          {daily.map((item) => (
            <Link
              key={item.date}
              href={`/admin?day=${item.date}`}
              className={`dash-bar${item.date === day ? " sel" : ""}`}
              title={`${item.date} — ${item.sent} sent, ${item.failed} failed, ${item.skipped} skipped`}
            >
              <i style={{ height: `${Math.round(((item.sent + item.failed + item.skipped) / maxDay) * 100)}%` }} />
              <small>{item.label}</small>
            </Link>
          ))}
        </div>
        <p className="plans-note">
          Hover a day for the sent / failed / skipped breakdown, or click it to see every
          email logged that day.
        </p>

        <p className="dash-day-head">Emails sent on {day}</p>
        {dayRows.length ? (
          <div className="subs-table-wrap">
            <table className="subs-table">
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Newsletter</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Time (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row, index) => (
                  <tr key={`${row.email}-${row.letter}-${index}`}>
                    <td>
                      <span className="subs-mail">{row.email}</span>
                    </td>
                    <td>{row.letter}</td>
                    <td className="subs-format">{row.kind === "issue" ? "Issue" : "Welcome"}</td>
                    <td>
                      <span className={`send-chip ${row.status}`}>
                        <em>{STATUS_LABEL[row.status]}</em>
                      </span>
                    </td>
                    <td className="subs-since">{timeFormat.format(new Date(row.sentAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="side-note">No emails recorded for this day.</p>
        )}
      </section>
    </>
  );
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}
