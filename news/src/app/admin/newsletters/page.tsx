import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DeliveryCentre from "@/components/admin/DeliveryCentre";
import DeliveryDetail from "@/components/admin/DeliveryDetail";
import SchedulerPanel from "@/components/admin/SchedulerPanel";
import TemplateManager from "@/components/admin/TemplateManager";
import { PageSkeleton } from "@/components/States";
import { getSessionUser } from "@/lib/auth";
import { getTemplates } from "@/lib/deliveryEngine";
import {
  buildDeliveryFilter,
  DELIVERY_STATUSES,
  fetchDeliveryDetail,
  fetchDeliveryPage,
  fetchEditionsPage,
  fetchNewsletterOverview,
  fetchSchedulerStatus,
  subscriberCounts,
} from "@/lib/newsletterAdmin";
import { fetchSubscriberDashboard } from "@/lib/queries";

export const metadata: Metadata = { title: "Newsletters", robots: { index: false } };

const TABS = [
  ["overview", "Overview"],
  ["templates", "Templates"],
  ["editions", "Editions"],
  ["subscribers", "Subscribers"],
  ["deliveries", "Delivery Centre"],
  ["scheduler", "Scheduler & Logs"],
  ["settings", "Settings"],
] as const;

type Tab = (typeof TABS)[number][0];

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function fmtTime(iso?: string | Date) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

function StatusChip({ status }: { status: string }) {
  return <span className={`nc-status nc-${status.toLowerCase()}`}>{status}</span>;
}

async function Overview({ range }: { range: number }) {
  const [stats, scheduler] = await Promise.all([fetchNewsletterOverview(range), fetchSchedulerStatus()]);
  const d = stats.deliveries;
  const card = (label: string, value: React.ReactNode, hint?: string) => (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  );
  return (
    <>
      <dl className="profile-stats nc-stats">
        {card("Subscribers", stats.subscribers.total, `${stats.subscribers.active} with letters`)}
        {card("Premium readers", stats.subscribers.premium)}
        {card("Suppressed", stats.subscribers.suppressed, "bounces & complaints")}
        {card("Scheduled", (d.SCHEDULED ?? 0) + (d.QUEUED ?? 0), `in last ${range}d`)}
        {card("Sent", (d.SENT ?? 0) + (d.DELIVERED ?? 0) + (d.DELAYED ?? 0))}
        {card("Delivered", d.DELIVERED ?? 0)}
        {card("Pending", (d.QUEUED ?? 0) + (d.PROCESSING ?? 0))}
        {card("Failed", d.FAILED ?? 0)}
        {card("Missed", d.MISSED ?? 0)}
        {card("Bounced", d.BOUNCED ?? 0)}
        {card("Success rate", stats.successRate === null ? "—" : `${stats.successRate}%`, "of resolved sends")}
      </dl>

      <section className="section-block">
        <div className="section-head">
          <h2>Scheduler health</h2>
          <Link href="?tab=scheduler" className="more">
            Details →
          </Link>
        </div>
        <p className="side-note">
          Last heartbeat <strong>{fmtTime(scheduler.state?.heartbeatAt)}</strong>
          {" · "}last run <strong>{fmtTime(scheduler.state?.lastRunFinishedAt)}</strong>
          {" · "}status <strong>{scheduler.state?.lastRunStatus ?? "never run"}</strong>
          {" · "}overdue deliveries <strong>{scheduler.overdue}</strong>
        </p>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>Last {range} days</h2>
          <div className="nc-ranges">
            {[7, 30].map((n) => (
              <Link key={n} href={`?tab=overview&range=${n}`} className={`cat-flag${range === n ? " on" : ""}`}>
                {n}d
              </Link>
            ))}
          </div>
        </div>
        {stats.daily.length ? (
          <div className="dash-bars" role="img" aria-label="Deliveries per day">
            {stats.daily.map((day) => {
              const max = Math.max(...stats.daily.map((x) => x.sent), 1);
              return (
                <div key={day.date} className="dash-day" title={`${day.date}: ${day.sent} sent, ${day.delivered} delivered, ${day.failed} failed`}>
                  <span className="dash-bar sent" style={{ height: `${Math.max(2, (day.sent / max) * 100)}%` }} />
                  <span className="dash-bar failed" style={{ height: `${Math.max(0, (day.failed / max) * 100)}%` }} />
                  <em>{day.date.slice(5)}</em>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="side-note">No deliveries recorded in this window yet.</p>
        )}
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>By newsletter</h2>
        </div>
        <div className="subs-table-wrap">
          <table className="subs-table">
            <thead>
              <tr>
                <th>Newsletter</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Failed</th>
                <th>Bounced</th>
              </tr>
            </thead>
            <tbody>
              {stats.perLetter.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.sent}</td>
                  <td>{row.delivered}</td>
                  <td>{row.failed}</td>
                  <td>{row.bounced}</td>
                </tr>
              ))}
              {!stats.perLetter.length && (
                <tr>
                  <td colSpan={5}>No sends yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>Recent failures</h2>
        </div>
        <div className="subs-table-wrap">
          <table className="subs-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Newsletter</th>
                <th>Reason</th>
                <th>At</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFailures.map((row, i) => (
                <tr key={i}>
                  <td className="subs-mail">{row.email}</td>
                  <td>{row.letter}</td>
                  <td>{row.reason ?? "—"}</td>
                  <td>{fmtTime(row.at)}</td>
                </tr>
              ))}
              {!stats.recentFailures.length && (
                <tr>
                  <td colSpan={4}>Nothing has failed recently.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

async function Editions({ page, templateId, editionId }: { page: number; templateId?: string; editionId?: string }) {
  const [{ rows, total, pages }, templates] = await Promise.all([
    fetchEditionsPage({ page, templateId }),
    getTemplates(),
  ]);
  const names = new Map(templates.map((t) => [t.id, t.name]));
  return (
    <>
      <form method="get" className="nc-filters">
        <input type="hidden" name="tab" value="editions" />
        <label className="cms-field small">
          <span>Newsletter</span>
          <select name="templateId" defaultValue={templateId ?? ""}>
            <option value="">All newsletters</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button outline">
          Filter
        </button>
      </form>
      <p className="side-note">
        {total} edition{total === 1 ? "" : "s"}
      </p>
      <div className="subs-table-wrap">
        <table className="subs-table">
          <thead>
            <tr>
              <th>Edition</th>
              <th>Newsletter</th>
              <th>Period</th>
              <th>Status</th>
              <th>Stories</th>
              <th>Scheduled</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row._id)} className={String(row._id) === editionId ? "nc-row-sel" : undefined}>
                <td>{row.subject}</td>
                <td>{names.get(row.templateId) ?? row.templateId}</td>
                <td>{row.periodKey}</td>
                <td>
                  <StatusChip status={row.status.toUpperCase()} />
                  {row.skipReason ? <small className="nc-reason">{row.skipReason}</small> : null}
                </td>
                <td>{row.articleCount}</td>
                <td>{fmtTime(row.scheduledAt)}</td>
                <td>{fmtTime(row.createdAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7}>No editions generated yet — they appear after the first scheduler run.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {page > 1 ? (
            <Link href={`?tab=editions&page=${page - 1}${templateId ? `&templateId=${templateId}` : ""}`} className="button outline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="pager-info">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`?tab=editions&page=${page + 1}${templateId ? `&templateId=${templateId}` : ""}`} className="button outline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

async function Subscribers() {
  const subs = await fetchSubscriberDashboard();
  return (
    <div className="subs-table-wrap">
      <table className="subs-table">
        <thead>
          <tr>
            <th>Subscriber</th>
            <th>Newsletters</th>
            <th>Since</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((sub) => (
            <tr key={sub.email}>
              <td className="subs-mail">
                <span className="subs-name">{sub.name ?? sub.email}</span>
                {sub.name ? <span className="subs-mail-addr">{sub.email}</span> : null}
              </td>
              <td className="subs-letters">
                {sub.letters.map((letter) => (
                  <span key={letter.id} className={`subs-letter status-${letter.status}`}>
                    {letter.name}
                    {letter.time ? ` · ${letter.time}` : ""}
                    <em>{letter.status}</em>
                  </span>
                ))}
                {!sub.letters.length && <span className="side-note">—</span>}
              </td>
              <td className="subs-since">{fmtTime(sub.subscribedAt)}</td>
            </tr>
          ))}
          {!subs.length && (
            <tr>
              <td colSpan={3}>No newsletter subscribers yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Settings() {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const row = (label: string, value: React.ReactNode) => (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
  return (
    <div className="subs-table-wrap">
      <table className="subs-table nc-settings">
        <tbody>
          {row("Email provider", "Brevo (api.brevo.com/v3/smtp/email)")}
          {row("BREVO_API_KEY", process.env.BREVO_API_KEY ? "Configured" : "Not set — sends are skipped")}
          {row("BREVO_SENDER", `${process.env.BREVO_SENDER_NAME ?? "Good Morning Indian"} <${process.env.BREVO_SENDER_EMAIL ?? "jskarthik10@gmail.com"}>`)}
          {row("CRON_SECRET", process.env.CRON_SECRET ? "Configured — endpoint requires it" : "Not set — endpoint is open")}
          {row("BREVO_WEBHOOK_SECRET", process.env.BREVO_WEBHOOK_SECRET ? "Configured" : "Not set")}
          {row("Catch-up window", `${process.env.DELIVERY_CATCH_UP_HOURS ?? 24} hours`)}
          {row("Batch per tick", process.env.DELIVERY_BATCH_SIZE ?? 20)}
          {row("Max send attempts", process.env.DELIVERY_MAX_ATTEMPTS ?? 5)}
          {row("Default timezone", process.env.DELIVERY_TZ ?? "Asia/Kolkata")}
          {row("Scheduler endpoint", <code>GET {siteUrl}/api/cron/deliver</code>)}
          {row("Webhook endpoint", <code>POST {siteUrl}/api/webhooks/brevo?token=&lt;secret&gt;</code>)}
          {row(
            "Cron setup",
            <span>
              Trigger the scheduler every minute: <code>* * * * * curl -s -H &quot;Authorization: Bearer $CRON_SECRET&quot; {siteUrl}/api/cron/deliver</code>
            </span>,
          )}
        </tbody>
      </table>
    </div>
  );
}

async function Body({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.role !== "admin" && user.role !== "editor") {
    return (
      <section className="compose">
        <p className="kicker">Admin</p>
        <h1>Newsletters</h1>
        <p className="form-note error" role="status">
          The newsletter centre is only available to admins and editors.
        </p>
      </section>
    );
  }

  const tab: Tab = (TABS.some(([id]) => id === params.tab) ? params.tab : "overview") as Tab;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  let content: React.ReactNode = null;
  if (tab === "overview") {
    content = <Overview range={Math.min(Math.max(parseInt(params.range ?? "30", 10) || 30, 7), 90)} />;
  } else if (tab === "templates") {
    const [templates, counts] = await Promise.all([getTemplates(), subscriberCounts()]);
    content = <TemplateManager templates={templates} counts={counts} />;
  } else if (tab === "editions") {
    content = <Editions page={page} templateId={params.templateId} editionId={params.edition} />;
  } else if (tab === "subscribers") {
    content = <Subscribers />;
  } else if (tab === "deliveries") {
    const filter = buildDeliveryFilter({
      date: params.date,
      from: params.from,
      to: params.to,
      templateId: params.templateId,
      status: params.status,
      source: params.source,
      q: params.q,
    });
    const [{ rows, total, pages }, templates, detail] = await Promise.all([
      fetchDeliveryPage({ filter, page, sort: params.sort }),
      getTemplates(),
      params.delivery ? fetchDeliveryDetail(params.delivery) : Promise.resolve(null),
    ]);
    content = (
      <>
        <DeliveryCentre
          rows={rows}
          total={total}
          page={page}
          pages={pages}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          params={params}
          statuses={DELIVERY_STATUSES as unknown as string[]}
        />
        {detail && <DeliveryDetail detail={detail} />}
      </>
    );
  } else if (tab === "scheduler") {
    const status = await fetchSchedulerStatus();
    content = <SchedulerPanel status={status} />;
  } else if (tab === "settings") {
    content = <Settings />;
  }

  return (
    <>
      <header className="page-head">
        <p className="kicker">Admin</p>
        <h1>Newsletters</h1>
        <p>
          Editions, deliveries and the scheduler.{" "}
          <Link href="/admin" className="more">
            Subscriptions admin →
          </Link>{" "}
          <Link href="/admin/layouts" className="more">
            Section layouts →
          </Link>
        </p>
      </header>
      <nav className="nc-tabs" aria-label="Newsletter centre">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`?tab=${id}`} className={`nc-tab${tab === id ? " on" : ""}`} aria-current={tab === id ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}

export default function AdminNewslettersPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body {...props} />
    </Suspense>
  );
}