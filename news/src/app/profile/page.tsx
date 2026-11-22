import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import { Offline, PageSkeleton } from "@/components/States";
import { getArticles, getSections } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Your profile" };

// Sample reader shown until real accounts exist.
const reader = {
  name: "Ananya Rao",
  initials: "AR",
  email: "ananya.rao@example.com",
  city: "Bengaluru",
  memberSince: "March 2025",
  plan: "Free reader",
  bio: "Reads the world desk with morning coffee and the longform pieces on Sundays.",
  storiesRead: 128,
  streak: 12,
  following: ["world", "technology", "science", "longform"],
};

const newsletters = [
  { id: "briefing", name: "The morning briefing", blurb: "Five stories before 7am, daily.", on: true },
  { id: "markets", name: "Markets close", blurb: "The day in numbers, weekdays at 6pm.", on: false },
  { id: "weekend", name: "Weekend longform", blurb: "Our best long reads, every Saturday.", on: true },
];

const joinedFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function ProfileContent() {
  const [sections, result, user] = await Promise.all([
    getSections(),
    getArticles({ limit: 8 }),
    getSessionUser(),
  ]);
  if (!sections || !result) return <Offline />;

  const saved = result.articles.slice(0, 3);
  const history = result.articles.slice(3, 8);
  const followed = new Set(reader.following);
  const display = user
    ? {
        ...reader,
        name: user.name,
        initials: initialsOf(user.name),
        email: user.email,
        memberSince: joinedFormat.format(user.createdAt),
        plan: "Google account",
        bio: "Signed in with your Google account.",
      }
    : reader;

  return (
    <>
      <header className="profile-head">
        {user?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="avatar profile-avatar" />
        ) : (
          <span className="avatar profile-avatar" aria-hidden="true">
            {display.initials}
          </span>
        )}
        <div className="profile-id">
          <p className="kicker">Reader profile</p>
          <h1>{display.name}</h1>
          <p className="dek">{display.bio}</p>
          <p className="meta">
            <span>{display.city}</span>
            <span>Member since {display.memberSince}</span>
            <span className="tag">{display.plan}</span>
          </p>
        </div>
        <div className="profile-actions">
          <button type="button" className="button outline" disabled>
            Edit profile
          </button>
          {user ? (
            <a href="/auth/signout" className="button">
              Sign out
            </a>
          ) : (
            <Link href="/signin" className="button">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <dl className="profile-stats">
        <div>
          <dt>Stories read</dt>
          <dd>{reader.storiesRead}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{saved.length}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{reader.streak}</dd>
        </div>
        <div>
          <dt>Desks followed</dt>
          <dd>{followed.size}</dd>
        </div>
      </dl>

      <div className="interior">
        <div>
          <section>
            <div className="section-head">
              <h2>Saved stories</h2>
            </div>
            <div className="grid">
              {saved.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-head">
              <h2>Recently read</h2>
            </div>
            <ol className="trend">
              {history.map((article) => (
                <li key={article.slug}>
                  <div>
                    <h3>
                      <Link href={`/article/${article.slug}`}>{article.title}</Link>
                    </h3>
                    <span className="kicker muted">
                      {article.sectionName} · {article.readMinutes} min · {article.ago}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="sidebar">
          <section className="side-block">
            <h2 className="rule-heading">Desks you follow</h2>
            <ul className="profile-desks">
              {sections.map((section) => (
                <li key={section.slug}>
                  <Link
                    href={`/section/${section.slug}`}
                    className={followed.has(section.slug) ? "tag solid" : "tag"}
                  >
                    {section.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="side-block">
            <h2 className="rule-heading">Newsletters</h2>
            <ul className="profile-prefs">
              {newsletters.map((item) => (
                <li key={item.id}>
                  <label>
                    <input type="checkbox" name={item.id} defaultChecked={item.on} />
                    <span>
                      <strong>{item.name}</strong>
                      {item.blurb}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="side-block">
            <h2 className="rule-heading">Account</h2>
            <dl className="profile-account">
              <div>
                <dt>Email</dt>
                <dd>{display.email}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{display.plan}</dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>Last changed 3 months ago</dd>
              </div>
            </dl>
            {!user && (
              <p className="side-note">Sample profile. Sign in to see your account.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
