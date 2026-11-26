import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Offline, PageSkeleton } from "@/components/States";
import { fetchAdminDashboard, fetchDashboard, type AdminDashboard } from "@/lib/analytics";
import { getSessionUser } from "@/lib/auth";
import { isEditorial } from "@/lib/roles";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };

// Day keys are YYYY-MM-DD; show them as MM/DD.
const dayLabel = (day: string) => day.slice(5).replace("-", "/");

async function DashboardContent() {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (!isEditorial(user.role)) {
    return (
      <section className="compose">
        <p className="kicker">Newsroom</p>
        <h1>Analytics</h1>
        <p className="form-note error" role="status">
          Analytics is available to editors, admins and journalists.
        </p>
      </section>
    );
  }

  // Editors and journalists track their own stories; admins get a newsroom view.
  const isAdmin = user.role === "admin";
  const data = await (isAdmin ? fetchAdminDashboard() : fetchDashboard(user.id)).catch(() => null);
  if (!data) return <Offline />;
  const adminData = isAdmin ? (data as AdminDashboard) : null;

  const { totals, daily, desks, top } = data;
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));
  const maxDesk = Math.max(1, ...desks.map((d) => d.readers));

  return (
    <>
      <header className="page-head">
        <p className="kicker">{isAdmin ? "Admin" : "Newsroom"}</p>
        <h1>{isAdmin ? "Newsroom analytics" : "Your article performance"}</h1>
        <p>
          {isAdmin
            ? "Sitewide story, audience and newsletter activity."
            : "Your stories · readers are signed-in people who opened a story"}
        </p>
      </header>

      <dl className="profile-stats">
        <div>
          <dt>Stories</dt>
          <dd>{totals.stories}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{totals.published}</dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd>{totals.scheduled}</dd>
        </div>
        <div>
          <dt>Readers</dt>
          <dd>{totals.readers}</dd>
        </div>
        <div>
          <dt>{isAdmin ? "Views" : "Readers per story"}</dt>
          <dd>{isAdmin ? totals.views : totals.perStory}</dd>
        </div>
      </dl>

      {adminData && (
        <section className="section-block">
          <div className="section-head">
            <h2>Audience &amp; delivery</h2>
          </div>
          <dl className="profile-stats">
            <div>
              <dt>Accounts</dt>
              <dd>{adminData.audience.accounts}</dd>
            </div>
            <div>
              <dt>Editorial staff</dt>
              <dd>{adminData.audience.editorial}</dd>
            </div>
            <div>
              <dt>Subscriber addresses</dt>
              <dd>{adminData.audience.subscriberAddresses}</dd>
            </div>
            <div>
              <dt>Newsletter subscriptions</dt>
              <dd>{adminData.audience.subscriptions}</dd>
            </div>
            <div>
              <dt>Emails sent</dt>
              <dd>{adminData.audience.emailsSent}</dd>
            </div>
            <div>
              <dt>Failed / skipped</dt>
              <dd>
                {adminData.audience.emailsFailed} / {adminData.audience.emailsSkipped}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <div className="interior">
        <div>
          <section>
            <div className="section-head">
              <h2>New readers, last 14 days</h2>
            </div>
            <div className="dash-bars" role="img" aria-label="New readers per day">
              {daily.map((d) => (
                <div key={d.day} className="dash-bar" title={`${d.count} new readers`}>
                  <i style={{ height: `${(d.count / maxDaily) * 100}%` }} />
                  <small>{dayLabel(d.day)}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-head">
              <h2>Top stories</h2>
            </div>
            {top.length ? (
              <ol className="trend">
                {top.map((story, index) => (
                  <li key={story.slug}>
                    <span className="rank">{index + 1}</span>
                    <div>
                      <h3>
                        <Link href={`/article/${story.slug}`}>{story.title}</Link>
                      </h3>
                      <span className="kicker muted">
                        {story.sectionName} · {story.readers} {story.readers === 1 ? "reader" : "readers"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="side-note">No published stories yet.</p>
            )}
          </section>
        </div>

        <aside className="sidebar">
          <section className="side-block">
            <h2 className="rule-heading">Readers by desk</h2>
            {desks.length ? (
              <ul className="dash-desks">
                {desks.map((desk) => (
                  <li key={desk.name}>
                    <span>{desk.name}</span>
                    <span className="dash-track">
                      <i style={{ width: `${(desk.readers / maxDesk) * 100}%` }} />
                    </span>
                    <span className="market-value">{desk.readers}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="side-note">No readers yet.</p>
            )}
          </section>

          {adminData && (
            <section className="side-block">
              <h2 className="rule-heading">Staff performance</h2>
              {adminData.staff.length ? (
                <ol className="trend">
                  {adminData.staff.map((member, index) => (
                    <li key={member.id}>
                      <span className="rank">{index + 1}</span>
                      <div>
                        <h3>{member.name}</h3>
                        <span className="kicker muted">
                          {member.role} · {member.published} published · {member.scheduled} scheduled ·{" "}
                          {member.readers} {member.readers === 1 ? "reader" : "readers"} · {member.views} views
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="side-note">No staff stories yet.</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
