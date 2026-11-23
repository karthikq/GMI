import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Offline, PageSkeleton } from "@/components/States";
import { fetchDashboard } from "@/lib/analytics";
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

  // Journalists see their own stories; editors and admins see the whole newsroom.
  const ownOnly = user.role === "journalist";
  const data = await fetchDashboard(ownOnly ? user.id : undefined).catch(() => null);
  if (!data) return <Offline />;

  const { totals, daily, desks, top } = data;
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));
  const maxDesk = Math.max(1, ...desks.map((d) => d.readers));

  return (
    <>
      <header className="page-head">
        <h1>Analytics</h1>
        <p>
          {ownOnly ? "Your stories" : "The whole newsroom"} · readers are signed-in people who opened a
          story
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
          <dt>Readers per story</dt>
          <dd>{totals.perStory}</dd>
        </div>
      </dl>

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
