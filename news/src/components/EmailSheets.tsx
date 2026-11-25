import { nextIssueDate } from "@/lib/newsletters";
import type { Newsletter, SampleStory } from "@/lib/newsletters";

/* The email templates shown in the example-email preview. Every skin renders
   the same `letter.sample` data — only the layout changes. `classic` is the
   free format; the rest are premium. */

function Img({ story, className }: { story: SampleStory; className?: string }) {
  return (
    <div className={className}>
      {/* Remote placeholder photos; next/image gains nothing inside the preview. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={story.image} alt={story.title} loading="lazy" />
    </div>
  );
}

function CoffeeCup() {
  return (
    <svg viewBox="0 0 72 72" width="64" height="64" aria-hidden="true" className="email-cup">
      <circle cx="36" cy="38" r="30" fill="rgba(0,0,0,0.06)" />
      <circle cx="36" cy="36" r="30" fill="#ebe4d5" stroke="#d4ccbe" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="22" fill="none" stroke="#dcc9a8" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M 52 28 C 62 28, 62 44, 52 44" fill="none" stroke="#f8f6f0" strokeWidth="4" strokeLinecap="round" />
      <path d="M 52 28 C 62 28, 62 44, 52 44" fill="none" stroke="#cdc4b4" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="36" cy="36" r="19" fill="#fcfbf8" stroke="#cdc4b4" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="15" fill="#22150f" />
      <path d="M 28 34 C 30 30, 42 30, 44 36 C 42 42, 32 40, 30 37" fill="none" stroke="#965f37" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <ellipse cx="32" cy="30" rx="3" ry="1.5" fill="#ffffff" opacity="0.35" transform="rotate(-20 32 30)" />
    </svg>
  );
}

/* ---- Daily Edition (default, free): black & white front page --------------- */

function DailySheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third, ...rest] = sample.stories;
  return (
    <div className="fmt-sheet fmt-daily">
      <div className="fmt-daily-logo">
        {/* Static brand asset; matches how the header renders the logo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Good Morning Indian" />
      </div>
      <div className="fmt-daily-meta">
        <span>{letter.name}</span>
        <span>{sample.volNumber}</span>
        <span>{nextIssueDate(letter.cadence)}</span>
      </div>
      <h1 className="fmt-daily-headline">{sample.headline}</h1>
      <p className="fmt-daily-subtitle">{letter.tagline}</p>
      <Img story={lead} className="fmt-daily-hero" />
      <div className="fmt-daily-grid">
        <div className="fmt-daily-left">
          <Img story={second} className="fmt-daily-img" />
          <p>
            {sample.leadDek} {lead.summary}
          </p>
        </div>
        <div className="fmt-daily-right">
          <p>
            <strong>{second.tag}.</strong> {second.title} — {second.summary} {letter.blurb}
          </p>
          <div className="fmt-daily-sub">
            <div>
              <h2>{third.tag}</h2>
              <p>
                {third.title}. {third.summary}
              </p>
            </div>
            <Img story={third} className="fmt-daily-img" />
          </div>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="fmt-daily-extra">
          {rest.map((story, index) => (
            <div key={index} className="fmt-daily-extra-item">
              <h3>{story.tag}</h3>
              <p>
                <strong>{story.title}.</strong> {story.summary}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="fmt-daily-foot">
        <span>{sample.ctaText}</span>
        <span>{sample.footerTag}</span>
      </div>
    </div>
  );
}

/* ---- Classic Broadsheet ---------------------------------------------------- */

function ClassicSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  return (
    <div className="email-sheet">
      <div className="email-sheet-top">
        <span>{sample.topBannerLeft}</span>
        <span>{sample.topBannerRight}</span>
      </div>
      <h1 className="email-sheet-masthead">{letter.name}</h1>
      <div className="email-sheet-bar">
        <span>{sample.volNumber}</span>
        <span className="email-sheet-sub">{sample.subHeader}</span>
        <span>{nextIssueDate(letter.cadence)}</span>
      </div>
      <div className="email-sheet-topics">{letter.topics.join("  /  ")}  /  A BRIGHTER TOMORROW</div>
      <div className="email-sheet-lead">
        <div className="email-lead-left">
          <h2 className="email-lead-title">{sample.headline}</h2>
          <p className="email-lead-dek">{sample.leadDek}</p>
        </div>
        {sample.quote && (
          <div className="email-lead-right">
            <p className="email-lead-note">{sample.quote.kicker}</p>
            <div className="email-cup-wrap">
              <CoffeeCup />
            </div>
            <blockquote className="email-quote-text">&ldquo;{sample.quote.text}&rdquo;</blockquote>
            <div className="email-quote-rule" />
            <p className="email-quote-attr">{sample.quote.attribution}</p>
          </div>
        )}
      </div>
      <div className="email-sheet-stories">
        {sample.stories.map((story, index) => (
          <article key={index} className="email-story-card">
            <Img story={story} className="email-story-img-wrap" />
            <span className="email-story-tag">{story.tag}</span>
            <h3 className="email-story-title">{story.title}</h3>
            <p className="email-story-summary">{story.summary}</p>
          </article>
        ))}
      </div>
      <div className="email-sheet-foot">
        <div className="email-foot-left">
          <strong>Visit site</strong>
          <span>REAL IMPACT. EVERY WEEK.</span>
        </div>
        <div className="email-foot-center">
          <span className="email-cta-pill">{sample.ctaText}</span>
        </div>
        <div className="email-foot-right">
          <strong>TECH TODAY.</strong>
          <span>A BRIGHTER TOMORROW.</span>
        </div>
      </div>
      <div className="email-sheet-subfoot">
        <span>{sample.footerTag}</span>
      </div>
    </div>
  );
}

/* ---- Corporate Report: white, navy & orange business layout ---------------- */

function CorporateSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third, ...rest] = sample.stories;
  return (
    <div className="fmt-sheet fmt-corp">
      <div className="fmt-corp-kicker">
        <span>Good Morning Indian</span>
        <i aria-hidden="true" />
      </div>
      <h1 className="fmt-corp-masthead">{letter.name}</h1>
      <div className="fmt-corp-hero">
        <Img story={lead} className="fmt-corp-hero-img" />
        <span className="fmt-corp-bar" aria-hidden="true" />
      </div>
      <div className="fmt-corp-body">
        <div className="fmt-corp-box">
          <p className="fmt-corp-byline">Written by: The {letter.name} desk</p>
          <h2>{sample.headline}</h2>
          <p>{sample.leadDek}</p>
          <p>{lead.summary}</p>
        </div>
        <div className="fmt-corp-side">
          <h3>{second.title}</h3>
          <p>{second.summary}</p>
          <p>{letter.blurb}</p>
          <p>{sample.quote?.text ?? third.summary}</p>
        </div>
      </div>
      <div className="fmt-corp-foot">
        <div>
          <p>
            <strong>{third.tag}</strong> — {third.title}. {third.summary}
          </p>
          <span className="fmt-corp-more">{sample.ctaText}</span>
        </div>
        <Img story={third} className="fmt-corp-foot-img" />
      </div>
      {rest.length > 0 && (
        <div className="fmt-corp-extra">
          {rest.map((story, index) => (
            <div key={index} className="fmt-corp-extra-item">
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Heritage Print (vintage club gazette) -------------------------------- */

function HeritageSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third, ...rest] = sample.stories;
  return (
    <div className="fmt-sheet fmt-heritage">
      <div className="fmt-her-top">
        <span>Special Edition</span>
        <span>{sample.volNumber}</span>
        <span>{nextIssueDate(letter.cadence)}</span>
      </div>
      <h1 className="fmt-her-masthead">{letter.name}</h1>
      <div className="fmt-her-rule" />
      <div className="fmt-her-grid">
        <aside className="fmt-her-side">
          <strong>From the editor</strong>
          <p className="fmt-her-side-kicker">{sample.quote?.kicker ?? letter.tagline}</p>
          <p>{sample.quote?.text ?? letter.blurb}</p>
          <p className="fmt-her-side-attr">{sample.quote?.attribution}</p>
          <div className="fmt-her-access">
            <span>{letter.cadence}</span>
            <span>Member edition</span>
          </div>
        </aside>
        <div className="fmt-her-main">
          <h2 className="fmt-her-headline">{sample.headline}</h2>
          <p className="fmt-her-dek">{sample.leadDek}</p>
          <Img story={lead} className="fmt-her-img" />
        </div>
      </div>
      <div className="fmt-her-marquee">{letter.topics.join(", ").toUpperCase()}</div>
      <div className="fmt-her-strip">
        <Img story={second} className="fmt-her-strip-img" />
        <div className="fmt-her-col">
          <strong>{second.tag}</strong>
          <p>{second.title}</p>
          <p className="fmt-her-col-sum">{second.summary}</p>
        </div>
        <div className="fmt-her-col">
          <strong>{third.tag}</strong>
          <p>{third.title}</p>
          <p className="fmt-her-col-sum">{third.summary}</p>
        </div>
        <Img story={third} className="fmt-her-strip-img" />
      </div>
      {rest.length > 0 && (
        <div className="fmt-her-more">
          {rest.map((story, index) => (
            <div key={index} className="fmt-her-col">
              <strong>{story.tag}</strong>
              <p>{story.title}</p>
              <p className="fmt-her-col-sum">{story.summary}</p>
            </div>
          ))}
        </div>
      )}
      <div className="fmt-her-foot">{sample.footerTag}</div>
    </div>
  );
}

/* ---- Scrapbook Post (collage & sticky notes) ------------------------------- */

function ScrapbookSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const notes = [
    { className: "fmt-scrap-note yellow", text: letter.topics[0] },
    { className: "fmt-scrap-note pink", text: sample.quote?.kicker ?? letter.tagline },
    { className: "fmt-scrap-note purple", text: letter.topics[1] ?? letter.topics[0] },
  ];
  return (
    <div className="fmt-sheet fmt-scrap">
      <div className="fmt-scrap-stamp">Breaking News</div>
      <h1 className="fmt-scrap-title">{letter.name}</h1>
      <p className="fmt-scrap-tag">{letter.topics.join("  *  ")}</p>
      <p className="fmt-scrap-meta">
        {sample.volNumber} · {nextIssueDate(letter.cadence)} · {letter.cadence}
      </p>
      <div className="fmt-scrap-collage">
        {sample.stories.map((story, index) => (
          <figure key={index} className={`fmt-scrap-photo rot-${index % 2 === 0 ? "l" : "r"}`}>
            <Img story={story} className="fmt-scrap-photo-img" />
            <figcaption>{story.tag}</figcaption>
          </figure>
        ))}
        {notes.map((note, index) => (
          <span key={index} className={note.className}>
            {note.text}
          </span>
        ))}
      </div>
      <ul className="fmt-scrap-lines">
        {sample.stories.map((story, index) => (
          <li key={index}>
            <strong>{story.tag}</strong> — {story.title}
          </li>
        ))}
      </ul>
      <div className="fmt-scrap-ticker">
        <span>{sample.stories.map((story) => story.title.toUpperCase()).join("  •  ")}</span>
      </div>
      <div className="fmt-scrap-foot">{sample.footerTag}</div>
    </div>
  );
}

/* ---- Storefront Weekly (modern promo magazine) ----------------------------- */

function StorefrontSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third, ...rest] = sample.stories;
  return (
    <div className="fmt-sheet fmt-store">
      <div className="fmt-store-head">
        <span className="fmt-store-logo">GMI</span>
        <span className="fmt-store-week">Weekly Newsletter</span>
      </div>
      <div className="fmt-store-hero">
        <div className="fmt-store-slogan">
          <h2>{letter.tagline}</h2>
          <p>{letter.blurb}</p>
          <span className="fmt-store-pill">Read More</span>
        </div>
        <Img story={lead} className="fmt-store-hero-img" />
      </div>
      <div className="fmt-store-offer">
        <Img story={second} className="fmt-store-offer-img" />
        <div className="fmt-store-offer-body">
          <h3>Special Offer</h3>
          <p>{second.title}</p>
          <h3>Limited Time Only</h3>
          <p>{second.summary}</p>
          <span className="fmt-store-pill">{sample.ctaText}</span>
        </div>
      </div>
      <div className="fmt-store-weekend">
        <div className="fmt-store-weekend-box">
          <h3>Only this {letter.cadence.toLowerCase().replace("every ", "")}</h3>
          <p>{third.title}</p>
          <p className="fmt-store-small">{third.summary}</p>
          <span className="fmt-store-pill dark">Read More</span>
        </div>
        <div className="fmt-store-weekend-r">
          <h3>Inside this issue</h3>
          <p>{lead.title}</p>
          <Img story={third} className="fmt-store-weekend-img" />
          <div className="fmt-store-darkbar">{sample.footerTag}</div>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="fmt-store-more">
          {rest.map((story, index) => (
            <div key={index} className="fmt-store-more-item">
              <Img story={story} className="fmt-store-more-img" />
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
            </div>
          ))}
        </div>
      )}
      <div className="fmt-store-foot">
        <div>
          <strong>Visit Us</strong>
          <span>Good Morning Indian HQ</span>
        </div>
        <div>
          <strong>Contact</strong>
          <span>letters@goodmorningindian.in</span>
        </div>
        <div>
          <strong>Website</strong>
          <span>www.goodmorningindian.in</span>
        </div>
      </div>
    </div>
  );
}

/* ---- Skyline Dispatch: dark navy & sky-blue company summary --------------- */

function SkylineSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third, ...rest] = sample.stories;
  return (
    <div className="fmt-sheet fmt-sky">
      <div className="fmt-sky-top">
        <span>Good Morning Indian</span>
        <i aria-hidden="true" />
        <span>{nextIssueDate(letter.cadence)}</span>
      </div>
      <div className="fmt-sky-head">
        <h1 className="fmt-sky-masthead">{letter.name}</h1>
        <span className="fmt-sky-block" aria-hidden="true" />
      </div>
      <Img story={lead} className="fmt-sky-hero" />
      <div className="fmt-sky-grid">
        <div className="fmt-sky-box">
          <h2>{sample.headline}</h2>
          <p>{sample.leadDek}</p>
          <p>{lead.summary}</p>
        </div>
        <div className="fmt-sky-side">
          <Img story={second} className="fmt-sky-side-img" />
          <h3>{second.title}</h3>
          <p>{second.summary}</p>
          <h3>{third.title}</h3>
          <p>{third.summary}</p>
          {rest.map((story, index) => (
            <div key={index}>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="fmt-sky-foot">{sample.footerTag}</div>
    </div>
  );
}

/* ---- Modern Digest: clean numbered briefing -------------------------------- */

function DigestSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead] = sample.stories;
  return (
    <div className="fmt-sheet fmt-digest">
      <div className="fmt-dig-inner">
        <div className="fmt-dig-top">
          <span className="fmt-dig-logo">GMI</span>
          <span className="fmt-dig-date">{nextIssueDate(letter.cadence)}</span>
        </div>
        <h1 className="fmt-dig-title">{letter.name}</h1>
        <p className="fmt-dig-hello">
          Good morning. Here&rsquo;s what matters from the {letter.topics[0].toLowerCase()} desk —
          about a five-minute read.
        </p>

        <article className="fmt-dig-hero">
          <Img story={lead} className="fmt-dig-hero-img" />
          <span className="fmt-dig-pill">Top story</span>
          <h2>{sample.headline}</h2>
          <p>{sample.leadDek}</p>
        </article>

        <div className="fmt-dig-toc">
          <h3>In this issue</h3>
          <ol>
            {sample.stories.map((story, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                {story.title}
              </li>
            ))}
          </ol>
        </div>

        {sample.stories.map((story, index) => (
          <article key={index} className="fmt-dig-story">
            <Img story={story} className="fmt-dig-thumb" />
            <div>
              <span className="fmt-dig-tag">
                {index + 1} · {story.tag}
              </span>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
            </div>
          </article>
        ))}

        {sample.quote && (
          <blockquote className="fmt-dig-quote">
            <p>&ldquo;{sample.quote.text}&rdquo;</p>
            <cite>{sample.quote.kicker}</cite>
          </blockquote>
        )}

        <div className="fmt-dig-cta">
          <span>{sample.ctaText}</span>
        </div>
        <p className="fmt-dig-foot">
          You&rsquo;re receiving {letter.name} {letter.cadence.toLowerCase()} · Manage newsletters ·
          Unsubscribe
        </p>
      </div>
    </div>
  );
}

/* ---- Shared email footer: weather card, share prompt, socials & legal ---- */

function WeatherGlyph() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" className="fmt-sfoot-wicon">
      <g stroke="#c9932a" strokeWidth="2" strokeLinecap="round">
        <path d="M17 5v3.5M9 9l2.5 2.5M25 9l-2.5 2.5M5 17h3.5M8.5 25l2.5-2.5" />
      </g>
      <circle cx="17" cy="17" r="7" fill="#e0aa2e" />
      <path d="M34 37H21a6.5 6.5 0 0 1-1.2-12.9 9.5 9.5 0 0 1 18.4-2.6A6 6 0 0 1 34 37z" fill="#ece5d3" />
    </svg>
  );
}

function SocialGlyph({ kind }: { kind: "instagram" | "facebook" | "linkedin" | "youtube" }) {
  const paths = {
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
      </>
    ),
    facebook: (
      <path
        d="M14 8.5V7c0-.8.7-1.5 1.5-1.5H18V2h-3.5C11.7 2 10 4.2 10 7v1.5H7V12h3v9.5h4V12h3l1-3.5h-4z"
        fill="currentColor"
      />
    ),
    linkedin: (
      <path
        d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4v14h-4V8zM8.5 8h3.8v1.9h.05c.53-1 1.83-2.06 3.77-2.06 4 0 4.78 2.63 4.78 6.06V22h-4v-7.1c0-1.7-.03-3.88-2.37-3.88-2.37 0-2.73 1.85-2.73 3.76V22h-4V8z"
        fill="currentColor"
      />
    ),
    youtube: (
      <path
        d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.28 5 12 5 12 5s-6.28 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.72 19 12 19 12 19s6.28 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15.2V8.8l5.2 3.2-5.2 3.2z"
        fill="currentColor"
      />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

// The sign-off a real inbox email ends with — appended under every format
// skin in the preview so each one reads like a complete newsletter.
function SheetFoot({ letter }: { letter: Newsletter }) {
  return (
    <div className="fmt-sfoot">
      <p className="fmt-sfoot-note">Illustrative market figures, not live quotes.</p>
      <div className="fmt-sfoot-weather">
        <div>
          <p className="fmt-sfoot-weather-kicker">Your morning weather</p>
          <p className="fmt-sfoot-weather-city">Bengaluru · 23°C</p>
          <p className="fmt-sfoot-weather-sum">Partly cloudy · Wind E 12 km/h</p>
        </div>
        <WeatherGlyph />
      </div>
      <div className="fmt-sfoot-share">
        <h3>Enjoyed your morning read?</h3>
        <p>Share Good Morning India with someone who loves staying informed.</p>
        <span className="fmt-sfoot-share-btn">Share this newsletter</span>
      </div>
      <div className="fmt-sfoot-social">
        <SocialGlyph kind="instagram" />
        <SocialGlyph kind="facebook" />
        <SocialGlyph kind="linkedin" />
        <SocialGlyph kind="youtube" />
      </div>
      <p className="fmt-sfoot-legal">
        You&rsquo;re receiving this email because you subscribed to {letter.name}.
      </p>
      <p className="fmt-sfoot-links">
        <span>Unsubscribe</span>
        <span>Manage preferences</span>
        <span>Privacy policy</span>
      </p>
      <p className="fmt-sfoot-copy">
        © {new Date().getFullYear()} Good Morning India. All rights reserved.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function SheetSkin({ format, letter }: { format: string; letter: Newsletter }) {
  switch (format) {
    case "corporate":
      return <CorporateSheet letter={letter} />;
    case "heritage":
      return <HeritageSheet letter={letter} />;
    case "scrapbook":
      return <ScrapbookSheet letter={letter} />;
    case "storefront":
      return <StorefrontSheet letter={letter} />;
    case "skyline":
      return <SkylineSheet letter={letter} />;
    case "digest":
      return <DigestSheet letter={letter} />;
    case "classic":
      return <ClassicSheet letter={letter} />;
    default:
      return <DailySheet letter={letter} />;
  }
}

export default function EmailSheet({ format, letter }: { format: string; letter: Newsletter }) {
  return (
    <>
      <SheetSkin format={format} letter={letter} />
      <SheetFoot letter={letter} />
    </>
  );
}
