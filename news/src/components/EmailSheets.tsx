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

/* ---- Classic Broadsheet (free) ------------------------------------------ */

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
        <span>{sample.date}</span>
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

/* ---- Midnight Bulletin (brutalist black & white) ------------------------- */

function MidnightSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third] = sample.stories;
  return (
    <div className="fmt-sheet fmt-midnight">
      <h1 className="fmt-mid-masthead">{letter.name}</h1>
      <div className="fmt-mid-meta">
        <span>{sample.date}</span>
        <span>{sample.volNumber}</span>
      </div>
      <h2 className="fmt-mid-headline">{sample.headline}</h2>
      <p className="fmt-mid-sub">{letter.topics.join(" · ")}</p>
      <div className="fmt-mid-row">
        <Img story={lead} className="fmt-mid-img" />
        <div className="fmt-mid-box">
          <span className="fmt-mid-topic">Topic 1 · {lead.tag}</span>
          <h3>{lead.title}</h3>
          <p>{lead.summary}</p>
          <p className="fmt-mid-box-extra">{sample.leadDek}</p>
        </div>
      </div>
      <div className="fmt-mid-row fmt-mid-rev">
        <div className="fmt-mid-box">
          <span className="fmt-mid-topic">Topic 2 · {second.tag}</span>
          <h3>{second.title}</h3>
          <p>{second.summary}</p>
        </div>
        <Img story={second} className="fmt-mid-img" />
      </div>
      <div className="fmt-mid-row">
        <div className="fmt-mid-box">
          <span className="fmt-mid-topic">Topic 3 · {third.tag}</span>
          <h3>{third.title}</h3>
          <p>{third.summary}</p>
        </div>
        <Img story={third} className="fmt-mid-img" />
      </div>
      <div className="fmt-mid-foot">
        <span className="fmt-mid-cta">{sample.ctaText}</span>
        <span>{sample.footerTag}</span>
      </div>
    </div>
  );
}

/* ---- Heritage Print (vintage club gazette) -------------------------------- */

function HeritageSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third] = sample.stories;
  return (
    <div className="fmt-sheet fmt-heritage">
      <div className="fmt-her-top">
        <span>Special Edition</span>
        <span>{sample.volNumber}</span>
        <span>{sample.date}</span>
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
        {sample.volNumber} · {sample.date} · {letter.cadence}
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
  const [lead, second, third] = sample.stories;
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

/* ---- Executive Brief (swiss business grid) ---------------------------------- */

function ExecutiveSheet({ letter }: { letter: Newsletter }) {
  const { sample } = letter;
  const [lead, second, third] = sample.stories;
  return (
    <div className="fmt-sheet fmt-exec">
      <div className="fmt-exec-top">
        <span>
          {sample.date} / {sample.volNumber}
        </span>
        <span>www.goodmorningindian.in</span>
      </div>
      <h1 className="fmt-exec-masthead">{letter.name}</h1>
      <div className="fmt-exec-grid">
        <aside className="fmt-exec-side">
          <h3>{letter.tagline}</h3>
          <p>{letter.blurb}</p>
          <p>{sample.leadDek}</p>
          <Img story={lead} className="fmt-exec-side-img" />
          <span className="fmt-exec-visit">↗ Visit site</span>
        </aside>
        <div className="fmt-exec-main">
          <Img story={second} className="fmt-exec-hero" />
          <div className="fmt-exec-bottom">
            <h2 className="fmt-exec-headline">{sample.headline}</h2>
            <div className="fmt-exec-cols">
              <p>{second.summary}</p>
              <div>
                <Img story={third} className="fmt-exec-mini-img" />
                <p>{third.summary}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export default function EmailSheet({ format, letter }: { format: string; letter: Newsletter }) {
  switch (format) {
    case "midnight":
      return <MidnightSheet letter={letter} />;
    case "heritage":
      return <HeritageSheet letter={letter} />;
    case "scrapbook":
      return <ScrapbookSheet letter={letter} />;
    case "storefront":
      return <StorefrontSheet letter={letter} />;
    case "executive":
      return <ExecutiveSheet letter={letter} />;
    default:
      return <ClassicSheet letter={letter} />;
  }
}
