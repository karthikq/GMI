import type { Metadata } from "next";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import AvatarImg from "@/components/AvatarImg";
import InviteForm from "@/components/InviteForm";
import { Offline, PageSkeleton } from "@/components/States";
import { signOutUser } from "@/app/actions";
import { getArticles, getSections } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { profileImage } from "@/lib/avatar";
import { isEditorial } from "@/lib/roles";
import { fetchStoryList } from "@/lib/analytics";
import { fetchArticlesBySlugs } from "@/lib/queries";
import { getReaderStats, getRecentReadSlugs, getSavedSlugs } from "@/lib/reading";

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
  const [sections, user] = await Promise.all([getSections(), getSessionUser()]);
  if (!sections) return <Offline />;

  let saved: Awaited<ReturnType<typeof fetchArticlesBySlugs>>;
  let history: Awaited<ReturnType<typeof fetchArticlesBySlugs>>;
  let stats: { storiesRead: number; saved: number; streak: number; desks: Set<string> };

  if (user) {
    const userId = new ObjectId(user.id);
    const [readerStats, savedSlugs, readSlugs] = await Promise.all([
      getReaderStats(userId),
      getSavedSlugs(userId),
      getRecentReadSlugs(userId),
    ]);
    [saved, history] = await Promise.all([
      fetchArticlesBySlugs(savedSlugs),
      fetchArticlesBySlugs(readSlugs),
    ]);
    stats = readerStats;
  } else {
    const result = await getArticles({ limit: 8 });
    if (!result) return <Offline />;
    saved = result.articles.slice(0, 3);
    history = result.articles.slice(3, 8);
    stats = {
      storiesRead: reader.storiesRead,
      saved: saved.length,
      streak: reader.streak,
      desks: new Set(reader.following),
    };
  }

  const followed = stats.desks;
  const stories = user && isEditorial(user.role) ? await fetchStoryList(user.id) : null;
  const display = user
    ? {
        ...reader,
        name: user.name,
        initials: initialsOf(user.name),
        email: user.email,
        memberSince: joinedFormat.format(user.createdAt),
        plan: isEditorial(user.role)
          ? user.role[0].toUpperCase() + user.role.slice(1)
          : user.googleId
            ? "Google account"
            : "Reader account",
        bio: user.googleId
          ? "Signed in with your Google account."
          : "Signed in with your email and password.",
      }
    : reader;

  return (
    <>
      <header className="profile-head">
        {user ? (
          <AvatarImg src={profileImage(user)} className="avatar profile-avatar" />
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
          {user && isEditorial(user.role) && (
            <Link href="/analytics" className="button outline">
              Analytics
            </Link>
          )}
          {user && (
            <Link href="/profile/edit" className="button outline">
              Edit profile
            </Link>
          )}
          {user ? (
            <form action={signOutUser}>
              <button type="submit" className="button">
                Sign out
              </button>
            </form>
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
          <dd>{stats.storiesRead}</dd>
        </div>
        <div>
          <dt>Saved</dt>
          <dd>{stats.saved}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>{stats.streak}</dd>
        </div>
        <div>
          <dt>Desks followed</dt>
          <dd>{followed.size}</dd>
        </div>
      </dl>

      <div className="interior">
        <div>
          {stories && (
            <section>
              <div className="section-head">
                <h2>Your stories</h2>
              </div>
              {stories.length ? (
                <ol className="trend">
                  {stories.map((story) => (
                    <li key={story.slug}>
                      <div>
                        <h3>
                          <Link href={`/article/${story.slug}`}>{story.title}</Link>
                        </h3>
                        <span className="kicker muted">
                          {story.scheduled ? "Scheduled" : "Published"} · {story.sectionName} · {story.readers}{" "}
                          {story.readers === 1 ? "reader" : "readers"}
                        </span>{" "}
                        <Link href={`/article/${story.slug}/edit`} className="more">
                          Edit
                        </Link>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="side-note">Stories you publish will show up here.</p>
              )}
            </section>
          )}

          <section>
            <div className="section-head">
              <h2>Saved stories</h2>
            </div>
            {saved.length ? (
              <div className="grid">
                {saved.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            ) : (
              <p className="side-note">
                Nothing saved yet — tap the bookmark on any story to keep it here.
              </p>
            )}
          </section>

          <section className="section-block">
            <div className="section-head">
              <h2>Recently read</h2>
            </div>
            {history.length ? (
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
            ) : (
              <p className="side-note">Stories you open will show up here.</p>
            )}
          </section>
        </div>

        <aside className="sidebar">
          {user?.role === "admin" && (
            <section className="side-block">
              <h2 className="rule-heading">Invite to the newsroom</h2>
              <InviteForm />
            </section>
          )}

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
