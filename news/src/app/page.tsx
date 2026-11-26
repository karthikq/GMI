import Link from "next/link";
import { Suspense } from "react";
import ArticleCard, { ArticleImage, Meta } from "@/components/ArticleCard";
import ScrollReveal from "@/components/ScrollReveal";
import { Offline, PageSkeleton } from "@/components/States";
import ArchiveSection from "@/components/ArchiveSection";
import { getArticles, getHome, type Article } from "@/lib/api";
import { marketSlug } from "@/lib/markets";

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

function Columnist({ article }: { article: Article }) {
  return (
    <div className="columnist">
      <span className="avatar" aria-hidden="true">
        {initials(article.author)}
      </span>
      <div>
        <strong>{article.author}</strong>
        <span>Columnist · {article.city}</span>
      </div>
    </div>
  );
}

async function HomeContent() {
  const [home, archive] = await Promise.all([getHome(), getArticles({ newerThanDays: 7, limit: 4 })]);
  if (!home) return <Offline />;
  const { lead, briefs, top, across, desks, mostRead, markets, opinion, pictures } = home;
  const [topFeature, ...topRest] = top;
  const [opinionLead, ...columns] = opinion;

  return (
    <>
      <section className="front">
        <aside className="front-briefs">
          <h2 className="rule-heading">World in brief</h2>
          {briefs.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="brief" />
          ))}
          <Link href="/section/world" className="more">
            All world stories →
          </Link>
        </aside>

        <article className="lead">
          <Link href={`/article/${lead.slug}`} className="card-image" tabIndex={-1} aria-hidden="true">
            <ArticleImage article={lead} />
          </Link>
          <Link href={`/section/${lead.section}`} className="kicker">
            {lead.sectionName} · {lead.city}
          </Link>
          <h1>
            <Link href={`/article/${lead.slug}`}>{lead.title}</Link>
          </h1>
          <p className="dek">{lead.dek}</p>
          <Meta article={lead} />
        </article>

        <aside id="longform" className="front-top">
          <h2 className="rule-heading">More top stories</h2>
          {topFeature && <ArticleCard article={topFeature} />}
          {topRest.map((article) => (
            <article key={article.slug} className="brief">
              <Link href={`/section/${article.section}`} className="kicker">
                {article.sectionName}
              </Link>
              <h3>
                <Link href={`/article/${article.slug}`}>{article.title}</Link>
              </h3>
            </article>
          ))}
        </aside>
      </section>

      {across.length > 0 && (
        <section className="band across-band">
          <div className="across-head">
            <h2>Across the desks</h2>
            <span className="across-rule" aria-hidden="true" />
            <Link href="/archive" className="across-more">
              Full front page →
            </Link>
          </div>
          <div className="across-grid">
            {across.map((article) => (
              <ArticleCard key={article.slug} article={article} variant="across" />
            ))}
          </div>
        </section>
      )}

      <ArchiveSection initial={archive?.articles ?? []} />

      <div className="interior">
        <div className="desks">
          {desks.map(({ section, feature, list }) => (
            <section key={section.slug} id={section.slug} className="desk">
              <div className="section-head">
                <h2>{section.name}</h2>
                <Link href={`/section/${section.slug}`} className="more">
                  More {section.name.toLowerCase()} →
                </Link>
              </div>
              <div className="desk-grid">
                <article className="card desk-feature">
                  <Link
                    href={`/article/${feature.slug}`}
                    className="card-image"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <ArticleImage article={feature} />
                  </Link>
                  <div className="card-body">
                    <span className="kicker">{feature.city}</span>
                    <h3>
                      <Link href={`/article/${feature.slug}`}>{feature.title}</Link>
                    </h3>
                    <p className="dek">{feature.dek}</p>
                    <Meta article={feature} />
                  </div>
                </article>
                <ul className="desk-list">
                  {list.map((article) => (
                    <li key={article.slug} className="card">
                      <Link
                        href={`/article/${article.slug}`}
                        className="card-image"
                        tabIndex={-1}
                        aria-hidden="true"
                      >
                        <ArticleImage article={article} />
                      </Link>
                      <div>
                        <span className="kicker muted">{article.city}</span>
                        <h3>
                          <Link href={`/article/${article.slug}`}>{article.title}</Link>
                        </h3>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <aside className="sidebar">
          <section className="side-block">
            <h2 className="rule-heading">Most read</h2>
            <ol className="trend">
              {mostRead.map((article, index) => (
                <li key={article.slug}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <h3>
                      <Link href={`/article/${article.slug}`}>{article.title}</Link>
                    </h3>
                    <span className="kicker muted">
                      {article.sectionName} · {article.readMinutes} min
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="side-block">
            <h2 className="rule-heading">Markets</h2>
            <ul className="markets">
              {markets.map((market) => (
                <li key={market.name}>
                  <Link href={`/markets/${marketSlug(market.name)}`}>{market.name}</Link>
                  <span className="market-value">{market.value}</span>
                  <span className={market.change >= 0 ? "market-change up" : "market-change down"}>
                    {market.change >= 0 ? "▲" : "▼"} {Math.abs(market.change).toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="side-note">Sample figures, not a live feed.</p>
          </section>

          <section className="side-block promo">
            <h2 className="rule-heading">The morning briefing</h2>
            <p>Five stories that matter, in your inbox before 7am.</p>
            <a href="#subscribe" className="more">
              Sign up free →
            </a>
          </section>
        </aside>
      </div>

      {opinionLead && (
        <section id="opinion" className="band dark">
          <div className="section-head">
            <h2>Opinion &amp; ideas</h2>
            <Link href="/section/opinion" className="more">
              All columns →
            </Link>
          </div>
          <div className="op-grid">
            <article className="op-lead">
              <Link
                href={`/article/${opinionLead.slug}`}
                className="card-image"
                tabIndex={-1}
                aria-hidden="true"
              >
                <ArticleImage article={opinionLead} />
              </Link>
              <h3>
                <Link href={`/article/${opinionLead.slug}`}>{opinionLead.title}</Link>
              </h3>
              <p>{opinionLead.dek}</p>
              <Columnist article={opinionLead} />
            </article>
            {columns.map((article) => (
              <article key={article.slug} className="op-card">
                <Columnist article={article} />
                <h3>
                  <Link href={`/article/${article.slug}`}>{article.title}</Link>
                </h3>
                <p>{article.dek}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {pictures.length > 0 && (
        <section id="in-pictures" className="section-block">
          <div className="section-head">
            <h2>In pictures</h2>
            <Link href="/section/in-pictures" className="more">
              Photo desk →
            </Link>
          </div>
          <div className="gallery">
            {pictures.map((article) => (
              <Link key={article.slug} href={`/article/${article.slug}`}>
                <ArticleImage article={article} />
                <span className="caption">
                  <span>{article.city}</span>
                  {article.title}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ScrollReveal selector={REVEAL_TARGETS} />
    </>
  );
}

const REVEAL_TARGETS = [
  ".front-briefs > *",
  ".front .lead",
  ".front-top > *",
  ".across-head",
  ".across-grid > *",
  ".band .section-head",
  ".grid.four > *",
  ".desk",
  ".side-block",
  ".op-grid > *",
  ".section-block .section-head",
  ".gallery > *",
].join(", ");

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
