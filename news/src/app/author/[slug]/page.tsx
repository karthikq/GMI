import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ArticleCard from "@/components/ArticleCard";
import AvatarImg from "@/components/AvatarImg";
import { PageSkeleton } from "@/components/States";
import type { AuthorProfile, AuthorSort } from "@/lib/queries";
import { fetchAuthorPage } from "@/lib/queries";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
};

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchAuthorPage(slug, { pageSize: 1 }).catch(() => null);
  if (!data) notFound();
  const { profile } = data;
  const role = [profile.designation, profile.desk && `${profile.desk} desk`].filter(Boolean).join(" · ");
  const description = (
    profile.bio ??
    `${profile.name}${role ? `, ${role}` : ""} — ${profile.articleCount} published stor${
      profile.articleCount === 1 ? "y" : "ies"
    } on Good Morning Indian.`
  ).slice(0, 160);
  const canonical = `${SITE_URL}/author/${slug}`;
  return {
    title: `${profile.name} — Good Morning Indian`,
    description,
    alternates: { canonical },
    openGraph: {
      title: profile.name,
      description,
      url: canonical,
      type: "profile",
      ...(profile.photo ? { images: [profile.photo] } : {}),
    },
  };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

function PersonJsonLd({ profile, slug }: { profile: AuthorProfile; slug: string }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: `${SITE_URL}/author/${slug}`,
    ...(profile.photo ? { image: profile.photo } : {}),
    ...(profile.designation ? { jobTitle: profile.designation } : {}),
    ...(profile.email ? { email: `mailto:${profile.email}` } : {}),
    worksFor: { "@type": "Organization", name: "Good Morning Indian" },
    ...(profile.expertise.length ? { knowsAbout: profile.expertise } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="au-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ArticleList({
  slug,
  sort,
  page,
}: {
  slug: string;
  sort: AuthorSort;
  page: number;
}) {
  return (
    <Suspense fallback={<PageSkeleton />} key={`${slug}-${sort}-${page}`}>
      <ArticleListInner slug={slug} sort={sort} page={page} />
    </Suspense>
  );
}

async function ArticleListInner({
  slug,
  sort,
  page,
}: {
  slug: string;
  sort: AuthorSort;
  page: number;
}) {
  const data = await fetchAuthorPage(slug, { page, sort });
  if (!data) notFound();
  const { articles, total, pages } = data;
  const tabParam = sort === "popular" ? "&tab=popular" : "";

  return (
    <>
      {articles.length > 0 && (
        <div className="au-grid">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
      {!total && (
        <div className="nl-empty">
          <p>No published stories yet{sort === "popular" ? " to rank" : ""}.</p>
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {page > 1 ? (
            <Link href={`/author/${slug}?page=${page - 1}${tabParam}`} className="button outline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="pager-info">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/author/${slug}?page=${page + 1}${tabParam}`} className="button outline">
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

async function AuthorBody({ slug, tab, page }: { slug: string; tab: string; page: number }) {
  const data = await fetchAuthorPage(slug, { page, sort: tab === "popular" ? "popular" : "latest" });
  if (!data) notFound();
  const { profile } = data;
  const tabs = [
    { id: "latest", label: "Latest articles", href: `/author/${slug}` },
    { id: "popular", label: "Most popular", href: `/author/${slug}?tab=popular` },
    { id: "about", label: "About", href: `/author/${slug}?tab=about` },
  ];

  return (
    <>
      <PersonJsonLd profile={profile} slug={slug} />
      <header className="au-head">
        <div className="au-id">
          {profile.photo ? (
            <AvatarImg src={profile.photo} className="au-photo" alt={profile.name} />
          ) : (
            <span className="au-photo au-initials" aria-hidden="true">
              {initials(profile.name)}
            </span>
          )}
          <div className="au-id-main">
            <h1 className="au-name">{profile.name}</h1>
            <p className="au-role">
              {[profile.designation, profile.desk && `${profile.desk} desk`, profile.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {profile.email && (
              <a className="au-email" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            )}
          </div>
        </div>
        {profile.bio && <p className="au-bio">{profile.bio}</p>}
        {profile.expertise.length > 0 && (
          <ul className="au-tags">
            {profile.expertise.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        <div className="au-stats">
          <Stat label={profile.articleCount === 1 ? "Published story" : "Published stories"} value={profile.articleCount} />
          {profile.totalViews != null && (
            <Stat label="Article views" value={profile.totalViews.toLocaleString("en-IN")} />
          )}
          {profile.since != null && <Stat label="Writing since" value={profile.since} />}
        </div>
      </header>

      <nav className="nl-tabs au-tabs" aria-label="Author sections">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`nl-tab${tab === item.id || (item.id === "latest" && tab !== "popular" && tab !== "about") ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "about" ? (
        <div className="au-about">
          {profile.bio && (
            <section className="au-about-block">
              <h2>Biography</h2>
              <p>{profile.bio}</p>
            </section>
          )}
          {profile.experience && (
            <section className="au-about-block">
              <h2>Professional experience</h2>
              <p>{profile.experience}</p>
            </section>
          )}
          <div className="au-about-grid">
            {profile.expertise.length > 0 && (
              <section className="au-about-block">
                <h2>Areas of expertise</h2>
                <ul className="au-tags">
                  {profile.expertise.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </section>
            )}
            {profile.languages.length > 0 && (
              <section className="au-about-block">
                <h2>Languages</h2>
                <p>{profile.languages.join(", ")}</p>
              </section>
            )}
            {profile.email && (
              <section className="au-about-block">
                <h2>Contact</h2>
                <p>
                  <a className="au-email" href={`mailto:${profile.email}`}>
                    {profile.email}
                  </a>
                </p>
              </section>
            )}
          </div>
          {!profile.bio && !profile.experience && !profile.expertise.length && !profile.languages.length && !profile.email && (
            <div className="nl-empty">
              <p>No author details published yet.</p>
            </div>
          )}
        </div>
      ) : (
        <ArticleList slug={slug} sort={tab === "popular" ? "popular" : "latest"} page={page} />
      )}
    </>
  );
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const tab = query.tab === "popular" || query.tab === "about" ? query.tab : "latest";
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  return (
    <div className="au-page">
      <Suspense fallback={<PageSkeleton />} key={`${slug}-${tab}-${page}`}>
        <AuthorBody slug={slug} tab={tab} page={page} />
      </Suspense>
    </div>
  );
}
