import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { Fragment, Suspense } from "react";
import ArticleCard, { ArticleImage } from "@/components/ArticleCard";
import OwnerActions from "@/components/OwnerActions";
import ReadTracker from "@/components/ReadTracker";
import ReadingProgress from "@/components/ReadingProgress";
import SaveButton from "@/components/SaveButton";
import ShareButtons from "@/components/ShareButtons";
import { PageSkeleton } from "@/components/States";
import { getArticle } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isBookmarked } from "@/lib/reading";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scheduled?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await getArticle(slug);
  if (!data) return {};
  const { article } = data;
  return {
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.dek,
  };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

async function ArticleContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const { scheduled } = await searchParams;
  const [data, user] = await Promise.all([getArticle(slug), getSessionUser()]);
  if (!data) notFound();
  const { article, related, ownerId } = data;
  const isOwner = Boolean(user && ownerId && ownerId === user.id);
  const saved = user ? await isBookmarked(new ObjectId(user.id), slug) : false;
  const body = article.body ?? [];
  // Longer stories get a pull quote: the opening sentence of the closing paragraph, shown mid-story.
  const quote =
    body.length >= 4
      ? body[body.length - 1].replace(/<[^>]*>/g, " ").match(/^.+?[.!?](?=\s|$)/)?.[0]
      : undefined;
  const sectionHref = `/section/${article.section}`;

  return (
    <>
      <ReadingProgress />
      <ReadTracker slug={article.slug} section={article.section} />
      {scheduled === "1" && article.status === "scheduled" && (
        <p className="cms-note" role="status">
          This story is scheduled — it goes live on{" "}
          {dateFormat.format(new Date(article.publishedAt))}, {article.publishedTime}. Only you can
          see it here for now.
        </p>
      )}
      <article className="story">
        <header className="story-head">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> · <Link href={sectionHref}>{article.sectionName}</Link> ·{" "}
            <span>{article.city}</span>
          </nav>
          <p className="story-kicker">
            <Link href={sectionHref} className="tag solid">
              {article.sectionName}
            </Link>
            {article.breaking && <span className="tag live">Breaking</span>}
            {article.city}
          </p>
          <h1>{article.title}</h1>
          <p className="dek">{article.dek}</p>
          <div className="byrow">
            <span className="avatar" aria-hidden="true">
              {initials(article.author)}
            </span>
            <div className="by-info">
              <p className="by-name">By {article.author}</p>
              <p className="by-meta">
                {article.authorRole && <>{article.authorRole} · </>}
                <time dateTime={article.publishedAt}>
                  {dateFormat.format(new Date(article.publishedAt))}, {article.publishedTime}
                </time>
                {article.updatedAt && (
                  <time dateTime={article.updatedAt}>
                    {" "}
                    · Updated {dateFormat.format(new Date(article.updatedAt))},{" "}
                    {article.updatedTime}
                  </time>
                )}{" "}
                · {article.readMinutes} min read
              </p>
            </div>
            <div className="story-actions">
              <ShareButtons title={article.title} />
              <SaveButton
                slug={article.slug}
                section={article.section}
                initialSaved={saved}
                signedIn={Boolean(user)}
              />
              {isOwner && (
                <OwnerActions slug={article.slug} published={article.status === "published"} />
              )}
            </div>
          </div>
        </header>

        <figure className="story-cover">
          <ArticleImage article={article} />
          {article.caption && <figcaption className="figcap">{article.caption}</figcaption>}
        </figure>

        <div className="story-body">
          {body.map((paragraph, index) => (
            <Fragment key={index}>
              {quote && index === 2 && (
                <blockquote className="pull-quote">
                  <p>{quote}</p>
                  <cite>From the story</cite>
                </blockquote>
              )}
              {/* Body blocks are sanitized HTML from the newsroom editor. */}
              <div dangerouslySetInnerHTML={{ __html: paragraph }} />
            </Fragment>
          ))}

          {article.tags && article.tags.length > 0 && (
            <ul className="story-tags" aria-label="Topics">
              {article.tags.map((tag) => (
                <li key={tag} className="tag ink">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          {article.sources && article.sources.length > 0 && (
            <section className="story-sources" aria-label="Sources">
              <h2>Sources</h2>
              <ul>
                {article.sources.map((source, index) => (
                  <li key={index}>
                    <a href={source.url} target="_blank" rel="noopener">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {article.authorBio && (
            <aside className="author-box" aria-label="About the author">
              <span className="avatar large" aria-hidden="true">
                {initials(article.author)}
              </span>
              <div>
                <span className="kicker">About the author</span>
                <h3>{article.author}</h3>
                <p>{article.authorBio}</p>
              </div>
            </aside>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="band related" aria-labelledby="related-heading">
          <div className="sec-head">
            <h2 id="related-heading">More in {article.sectionName}</h2>
            <span className="rule" aria-hidden="true" />
            <Link href={sectionHref} className="more">
              All {article.sectionName} →
            </Link>
          </div>
          <div className="grid">
            {related.map((item) => (
              <ArticleCard key={item.slug} article={item} showSection={false} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function ArticlePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ArticleContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
