// The eight newsletter formats. Each renders the same EditionContent —
// table layouts, inline CSS, 600px max, no scripts. Shared primitives live
// in ./shared. The dispatcher EditionEmail is the single render entry for
// subscriber previews, admin previews, test sends and real deliveries.

import type { EditionContent, EditionStory } from "@/lib/editionContent";
import { normalizeFormatId } from "@/lib/newsletterFormats";
import {
  Cta,
  Divider,
  EditorsNote,
  EmailShell,
  FactBox,
  ImageFallback,
  Kicker,
  MarketSnapshot,
  PollBlock,
  QuizBlock,
  ReadMore,
  ReadTime,
  StoryImage,
  T,
  WhyItMatters,
} from "./shared";

type FormatProps = { c: EditionContent; logoSrc?: string; unsubscribeUrl?: string };

const text: React.CSSProperties = { fontFamily: T.sans, fontSize: 15, lineHeight: 1.6, color: T.soft };
const head: React.CSSProperties = { fontFamily: T.serif, color: T.ink, margin: 0 };

function trimWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  return words.length > max ? `${words.slice(0, max).join(" ")}…` : text;
}

function storyTitle(story: EditionStory, size = 16): React.ReactNode {
  return (
    <a href={story.url} target="_blank" rel="noopener noreferrer" style={{ ...head, fontSize: size, fontWeight: 700, lineHeight: 1.25, textDecoration: "none", display: "block" }}>
      {story.title}
      {story.premium ? (
        <span style={{ fontFamily: T.sans, fontSize: 9, fontWeight: 700, letterSpacing: "1px", color: T.mute, verticalAlign: "super" }}>
          {" "}PREMIUM
        </span>
      ) : null}
    </a>
  );
}

// ── 1. QUICK_READ — numbered, scannable, no images ─────────────────────────

function QuickRead({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      <p style={{ ...text, margin: "0 0 4px" }}>{c.stories.length} stories · about a 3-minute read.</p>
      {c.stories.map((story, i) => (
        <table key={story.slug} role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ padding: "14px 0", ...(i ? { borderTop: `1px solid ${T.line}` } : {}) }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          width: 30,
                          verticalAlign: "top",
                          fontFamily: T.serif,
                          fontSize: 22,
                          fontWeight: 700,
                          color: T.red,
                        }}
                      >
                        {i + 1}.
                      </td>
                      <td>
                        <Kicker>{story.tag}</Kicker>
                        <div style={{ margin: "4px 0" }}>{storyTitle(story, 16)}</div>
                        <p style={{ ...text, margin: "0 0 6px" }}>{trimWords(story.summary, 40)}</p>
                        <ReadMore href={story.url} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
      <Cta href={c.siteUrl} label="Read today's edition" />
    </EmailShell>
  );
}

// ── 2. DAILY_DIGEST — featured + cards, personalised (default) ─────────────

function DailyDigest({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const { extras } = c;
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      <p style={{ ...text, margin: "0 0 16px" }}>
        Good morning{extras.greetingName ? `, ${extras.greetingName}` : ""} — here is your digest.
      </p>
      {lead && (
        <div style={{ marginBottom: 18 }}>
          <StoryImage story={lead} width={552} />
          <div style={{ marginTop: 10 }}>
            <Kicker>{lead.tag}</Kicker>
            <div style={{ margin: "4px 0" }}>{storyTitle(lead, 22)}</div>
            <p style={{ ...text, margin: "0 0 8px" }}>{trimWords(lead.summary, 60)}</p>
            <ReadMore href={lead.url} />
          </div>
        </div>
      )}
      <Divider />
      {rest.map((story) => (
        <table key={story.slug} role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "14px 0" }}>
          <tbody>
            <tr>
              <td style={{ width: 116, verticalAlign: "top", paddingRight: 14 }}>
                {story.image ? (
                  <StoryImage story={story} width={116} />
                ) : (
                  <ImageFallback story={story} height={78} />
                )}
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Kicker>{story.tag}</Kicker>
                <div style={{ margin: "3px 0" }}>{storyTitle(story, 15)}</div>
                <p style={{ ...text, fontSize: 13, margin: "0 0 5px" }}>{trimWords(story.summary, 24)}</p>
                <table role="presentation" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ paddingRight: 12 }}>
                        <ReadTime story={story} />
                      </td>
                      <td>
                        <ReadMore href={story.url} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
      {extras.markets?.length ? (
        <>
          <Divider />
          <MarketSnapshot rows={extras.markets} source={extras.marketsSource} asOf={extras.marketsAsOf} />
        </>
      ) : null}
      {extras.fact ? <FactBox fact={extras.fact} /> : null}
      <Cta href={c.siteUrl} label="Read on Good Morning Indian" />
    </EmailShell>
  );
}

// ── 3. FULL_EDITION — newspaper layout, two columns on desktop ─────────────

const OPINION_TAGS = new Set(["OPINION", "ANALYSIS", "EDITORIAL", "COLUMN", "DEBATE", "COMMENT"]);

function EditorialCard({ story }: { story: EditionStory }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} className="em-card" style={{ marginBottom: 16 }}>
      <tbody>
        <tr>
          <td style={{ background: T.card, border: `1px solid ${T.line}`, padding: "14px 16px" }}>
            {story.featured ? <Kicker color={T.red}>Editor&rsquo;s pick</Kicker> : <Kicker>{story.tag}</Kicker>}
            <div style={{ margin: "4px 0" }}>{storyTitle(story, 16)}</div>
            <p style={{ ...text, fontSize: 14, margin: "0 0 8px" }}>{trimWords(story.summary, 34)}</p>
            <ReadMore href={story.url} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function FullEdition({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const news = rest.filter((s) => !OPINION_TAGS.has(s.tag));
  const opinion = rest.filter((s) => OPINION_TAGS.has(s.tag));
  const rows: EditionStory[][] = [];
  for (let i = 0; i < news.length; i += 2) rows.push(news.slice(i, i + 2));
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      {lead && (
        <div>
          <Kicker>{lead.tag}</Kicker>
          <div style={{ margin: "6px 0" }}>{storyTitle(lead, 26)}</div>
          <p style={{ ...text, fontSize: 16, margin: "0 0 12px" }}>{lead.summary}</p>
          <StoryImage story={lead} width={552} caption credit />
          {lead.lead ? <p style={{ ...text, margin: "12px 0 0" }}>{trimWords(lead.lead, 80)}</p> : null}
          {lead.whyItMatters ? <WhyItMatters text={lead.whyItMatters} /> : null}
          <ReadMore href={lead.url} />
        </div>
      )}
      <Divider heavy />
      {rows.map((pair, i) => (
        <table key={i} role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td className="em-col" style={{ paddingRight: pair[1] ? 10 : 0 }}>
                <EditorialCard story={pair[0]} />
              </td>
              {pair[1] && (
                <td className="em-col" style={{ paddingLeft: 10 }}>
                  <EditorialCard story={pair[1]} />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      ))}
      {opinion.length ? (
        <>
          <Divider heavy space={8} />
          <Kicker>Opinion &amp; analysis</Kicker>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              {opinion.map((story) => (
                <tr key={story.slug}>
                  <td style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
                    <div style={{ margin: "2px 0" }}>{storyTitle(story, 15)}</div>
                    <p style={{ ...text, fontSize: 13, margin: "0 0 4px" }}>{trimWords(story.summary, 22)}</p>
                    <ReadMore href={story.url} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      <Cta href={c.siteUrl} label="Read the full edition" />
    </EmailShell>
  );
}

// ── 4. VISUAL_EDITION — photographic, two-column gallery ───────────────────

function GalleryCard({ story }: { story: EditionStory }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} className="em-card" style={{ marginBottom: 18 }}>
      <tbody>
        <tr>
          <td>
            {story.image ? <StoryImage story={story} width={264} /> : <ImageFallback story={story} />}
            <div style={{ marginTop: 8 }}>
              <Kicker>{story.tag}</Kicker>
              <div style={{ margin: "3px 0" }}>{storyTitle(story, 15)}</div>
              <p style={{ ...text, fontSize: 13, margin: 0 }}>{trimWords(story.summary, 16)}</p>
              {story.caption || story.imageCredit ? (
                <p style={{ margin: "5px 0 0", fontFamily: T.sans, fontSize: 10, color: T.mute }}>
                  {story.caption}
                  {story.caption && story.imageCredit ? " · " : ""}
                  {story.imageCredit ? `Credit: ${story.imageCredit}` : ""}
                </p>
              ) : null}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function VisualEdition({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const rows: EditionStory[][] = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      {lead && (
        <div>
          {lead.image ? <StoryImage story={lead} width={552} /> : <ImageFallback story={lead} height={240} />}
          <div style={{ marginTop: 10 }}>
            <Kicker>{lead.tag}</Kicker>
            <div style={{ margin: "4px 0" }}>{storyTitle(lead, 24)}</div>
            <p style={{ ...text, margin: "0 0 8px" }}>{trimWords(lead.summary, 40)}</p>
            {lead.caption || lead.imageCredit ? (
              <p style={{ margin: "0 0 8px", fontFamily: T.sans, fontSize: 11, color: T.mute }}>
                {lead.caption}
                {lead.caption && lead.imageCredit ? " · " : ""}
                {lead.imageCredit ? `Credit: ${lead.imageCredit}` : ""}
              </p>
            ) : null}
            <ReadMore href={lead.url} />
          </div>
        </div>
      )}
      <Divider />
      {rows.map((pair, i) => (
        <table key={i} role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td className="em-col" style={{ paddingRight: pair[1] ? 10 : 0, verticalAlign: "top" }}>
                <GalleryCard story={pair[0]} />
              </td>
              {pair[1] && (
                <td className="em-col" style={{ paddingLeft: 10, verticalAlign: "top" }}>
                  <GalleryCard story={pair[1]} />
                </td>
              )}
            </tr>
          </tbody>
        </table>
      ))}
      <Cta href={c.siteUrl} label="See the full gallery" />
    </EmailShell>
  );
}

// ── 5. DEEP_DIVE — magazine analysis, dark charcoal + gold ─────────────────

function DeepDive({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const { extras } = c;
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl} dark>
      {lead && (
        <div>
          <Kicker color={T.gold}>{lead.tag} · In depth</Kicker>
          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...head, color: "#f0ede6", fontSize: 26, fontWeight: 700, lineHeight: 1.2, display: "block", margin: "8px 0 10px", textDecoration: "none" }}
          >
            {lead.title}
          </a>
          <p style={{ ...text, color: "#c9c4b8", fontSize: 16, margin: "0 0 4px" }}>{lead.summary}</p>
          <span style={{ fontFamily: T.sans, fontSize: 11, color: T.gold, display: "block", marginBottom: 10 }}>
            {lead.readMinutes} min read
          </span>
          <StoryImage story={lead} width={552} caption />
          {lead.lead ? (
            <>
              <p style={{ ...kickerDark, margin: "16px 0 6px" }}>Background &amp; context</p>
              <p style={{ ...text, color: "#c9c4b8", margin: 0 }}>{trimWords(lead.lead, 90)}</p>
            </>
          ) : null}
          {lead.whyItMatters ? <WhyItMatters text={lead.whyItMatters} dark /> : null}
          <ReadMore href={lead.url} dark />
        </div>
      )}
      <div style={{ borderTop: `1px solid ${T.gold}`, margin: "22px 0 14px" }} />
      <p style={{ ...kickerDark, margin: "0 0 8px" }}>Related reporting &amp; analysis</p>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          {rest.map((story) => (
            <tr key={story.slug}>
              <td style={{ padding: "10px 0", borderBottom: "1px solid #3a3f47" }}>
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...head, color: "#f0ede6", fontSize: 15, fontWeight: 700, display: "block", textDecoration: "none" }}
                >
                  {story.title}
                </a>
                <p style={{ ...text, fontSize: 13, color: "#a8a396", margin: "4px 0 4px" }}>{trimWords(story.summary, 24)}</p>
                <span style={{ fontFamily: T.sans, fontSize: 11, color: T.gold }}>
                  {story.tag} · {story.readMinutes} min read
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {extras.editorsNote ? <EditorsNote note={extras.editorsNote} dark /> : null}
      <Cta href={c.siteUrl} label="Read the full analysis" dark />
    </EmailShell>
  );
}

const kickerDark: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "1.6px",
  textTransform: "uppercase",
  color: T.gold,
};

// ── 6. DATA_BRIEF — numbers, charts & sources ──────────────────────────────

function DataBrief({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const { extras } = c;
  const topReads = [...c.stories].filter((s) => typeof s.reads === "number" && s.reads > 0).sort((a, b) => (b.reads ?? 0) - (a.reads ?? 0)).slice(0, 5);
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      <p style={{ ...text, margin: "0 0 14px" }}>The edition in numbers — with sources for every figure.</p>
      {extras.markets?.length ? (
        <MarketSnapshot rows={extras.markets} source={extras.marketsSource} asOf={extras.marketsAsOf} />
      ) : null}
      {topReads.length ? (
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
          <tbody>
            <tr>
              <td style={{ background: T.card, border: `1px solid ${T.line}`, padding: "14px 16px" }}>
                <Kicker>Most read on this desk</Kicker>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 8 }}>
                  <tbody>
                    {topReads.map((story) => (
                      <tr key={story.slug}>
                        <td style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, padding: "4px 8px 4px 0" }}>
                          <a href={story.url} target="_blank" rel="noopener noreferrer" style={{ color: T.ink, textDecoration: "none" }}>
                            {trimWords(story.title, 12)}
                          </a>
                        </td>
                        <td align="right" style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: T.soft, whiteSpace: "nowrap" }}>
                          {(story.reads ?? 0).toLocaleString("en-IN")} reads
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ margin: "8px 0 0", fontFamily: T.sans, fontSize: 10, color: T.mute }}>
                  Source: Good Morning Indian readership data · rolling counters
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <Divider />
      {lead && (
        <div>
          <Kicker>{lead.tag} · Data story</Kicker>
          <div style={{ margin: "4px 0" }}>{storyTitle(lead, 20)}</div>
          <p style={{ ...text, margin: "0 0 8px" }}>{trimWords(lead.summary, 50)}</p>
          <ReadMore href={lead.url} />
        </div>
      )}
      <Divider space={10} />
      {rest.map((story, i) => (
        <table key={story.slug} role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}` }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ width: 24, verticalAlign: "top", fontFamily: T.serif, fontSize: 16, fontWeight: 700, color: T.red }}>
                        {i + 2}.
                      </td>
                      <td>
                        <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: T.mute }}>
                          {story.tag}
                        </span>
                        <div style={{ margin: "2px 0" }}>{storyTitle(story, 15)}</div>
                        <p style={{ ...text, fontSize: 13, margin: "0 0 4px" }}>{trimWords(story.summary, 26)}</p>
                        <ReadMore href={story.url} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
      <Cta href={c.siteUrl} label="Open the data desk" />
    </EmailShell>
  );
}

// ── 7. READERS_EDITION — stories + poll, quiz & discussion ─────────────────

function ReadersEdition({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const [lead, ...rest] = c.stories;
  const main = rest.slice(0, 4);
  const recommended = rest.slice(4);
  const { extras } = c;
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      <p style={{ ...text, margin: "0 0 14px" }}>Your stories, your say — this edition includes today&rsquo;s poll and quiz.</p>
      {lead && (
        <div style={{ marginBottom: 16 }}>
          <StoryImage story={lead} width={552} />
          <div style={{ marginTop: 10 }}>
            <Kicker>{lead.tag}</Kicker>
            <div style={{ margin: "4px 0" }}>{storyTitle(lead, 20)}</div>
            <p style={{ ...text, margin: "0 0 8px" }}>{trimWords(lead.summary, 45)}</p>
            <ReadMore href={lead.url} />
          </div>
        </div>
      )}
      <Divider />
      {main.map((story) => (
        <table key={story.slug} role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}` }}>
                <Kicker>{story.tag}</Kicker>
                <div style={{ margin: "3px 0" }}>{storyTitle(story, 15)}</div>
                <p style={{ ...text, fontSize: 13, margin: "0 0 5px" }}>{trimWords(story.summary, 26)}</p>
                <ReadMore href={story.url} />
              </td>
            </tr>
          </tbody>
        </table>
      ))}
      {recommended.length ? (
        <>
          <p style={{ ...kickerStyle, margin: "16px 0 6px" }}>Recommended for you</p>
          {recommended.map((story) => (
            <p key={story.slug} style={{ margin: "6px 0", fontFamily: T.sans, fontSize: 14, lineHeight: 1.5 }}>
              <a href={story.url} target="_blank" rel="noopener noreferrer" style={{ color: T.red, fontWeight: 700, textDecoration: "none" }}>
                {story.title}
              </a>
            </p>
          ))}
        </>
      ) : null}
      {extras.poll ? <PollBlock poll={extras.poll} /> : null}
      {extras.quiz ? <QuizBlock quiz={extras.quiz} /> : null}
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
        <tbody>
          <tr>
            <td style={{ background: "#f2efe7", border: `1px solid ${T.line}`, padding: "14px 16px" }}>
              <Kicker>Have your say</Kicker>
              <p style={{ margin: "6px 0 8px", fontFamily: T.sans, fontSize: 13, lineHeight: 1.6, color: T.soft }}>
                Did today&rsquo;s lead get it right? Write back, or discuss this edition with other readers.
              </p>
              <a href={`mailto:letters@goodmorningindian.in?subject=${encodeURIComponent(`Re: ${c.letterName}`)}`} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.red, textDecoration: "none" }}>
                letters@goodmorningindian.in →
              </a>
              <span style={{ fontFamily: T.sans, fontSize: 12, color: T.mute }}>{"  ·  "}</span>
              <a href={`${c.siteUrl}/newsletters`} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.red, textDecoration: "none" }}>
                Manage your newsletters →
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <Cta href={c.siteUrl} label="Join the discussion" />
    </EmailShell>
  );
}

const kickerStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "1.6px",
  textTransform: "uppercase",
  color: T.red,
};

// ── 8. MINIMALIST — plain-text letter ──────────────────────────────────────

function Minimalist({ c, logoSrc, unsubscribeUrl }: FormatProps) {
  const { extras } = c;
  return (
    <EmailShell c={c} logoSrc={logoSrc} unsubscribeUrl={unsubscribeUrl}>
      <p style={{ fontFamily: T.serif, fontSize: 16, lineHeight: 1.6, color: T.ink, margin: "0 0 14px" }}>
        Good morning{extras.greetingName ? `, ${extras.greetingName}` : ""}.
      </p>
      <p style={{ fontFamily: T.serif, fontSize: 15, lineHeight: 1.7, color: T.soft, margin: "0 0 18px" }}>
        Here are {c.stories.length} stories worth your time today. Nothing else — just the news.
      </p>
      {c.stories.map((story, i) => (
        <p key={story.slug} style={{ fontFamily: T.serif, fontSize: 15, lineHeight: 1.7, color: T.ink, margin: "0 0 16px" }}>
          <strong>
            {i + 1}. {story.title}
          </strong>
          <span style={{ color: T.mute, fontSize: 12, fontFamily: T.sans }}> ({story.tag})</span>
          <br />
          <span style={{ color: T.soft }}>{trimWords(story.summary, 32)}</span>
          <br />
          <a href={story.url} target="_blank" rel="noopener noreferrer" style={{ color: T.red, fontSize: 13, fontFamily: T.sans }}>
            {story.url}
          </a>
        </p>
      ))}
      <p style={{ fontFamily: T.serif, fontSize: 15, lineHeight: 1.7, color: T.soft, margin: "20px 0 0" }}>
        Until next time,
        <br />
        The {c.letterName} desk
      </p>
    </EmailShell>
  );
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

export default function EditionEmail({
  format,
  c,
  logoSrc,
  unsubscribeUrl,
}: FormatProps & { format: string }) {
  const props = { c, logoSrc, unsubscribeUrl };
  switch (normalizeFormatId(format)) {
    case "quick_read":
      return <QuickRead {...props} />;
    case "daily_digest":
      return <DailyDigest {...props} />;
    case "full_edition":
      return <FullEdition {...props} />;
    case "visual_edition":
      return <VisualEdition {...props} />;
    case "deep_dive":
      return <DeepDive {...props} />;
    case "data_brief":
      return <DataBrief {...props} />;
    case "readers_edition":
      return <ReadersEdition {...props} />;
    case "minimalist":
      return <Minimalist {...props} />;
    default:
      return <DailyDigest {...props} />;
  }
}

// ── Format thumbnails (wireframe previews for the picker cards) ────────────

const bar = (w: string | number, h = 4, color = "#c9c4b8"): React.CSSProperties => ({
  width: w,
  height: h,
  background: color,
  borderRadius: 1,
  marginBottom: 4,
});
const imgBox = (h: number): React.CSSProperties => ({
  height: h,
  background: "#dcd7cb",
  borderRadius: 2,
  marginBottom: 5,
});

export function FormatThumb({ format }: { format: string }) {
  const id = normalizeFormatId(format);
  const wrap: React.CSSProperties = {
    background: "#faf9f5",
    border: "1px solid var(--line, #d8d3c8)",
    borderRadius: 6,
    padding: 8,
    height: 84,
    overflow: "hidden",
  };
  const row: React.CSSProperties = { display: "flex", gap: 6, marginBottom: 5 };
  const col: React.CSSProperties = { flex: 1, minWidth: 0 };
  let body: React.ReactNode;
  switch (id) {
    case "quick_read":
      body = [0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 5, marginBottom: 4, alignItems: "flex-start" }}>
          <div style={{ ...bar(8, 8, "#c8102e"), marginBottom: 0, borderRadius: 0 }} />
          <div style={col}>
            <div style={bar("40%", 3, "#c8102e")} />
            <div style={bar("92%")} />
            <div style={bar("70%")} />
          </div>
        </div>
      ));
      break;
    case "full_edition":
      body = (
        <>
          <div style={bar("86%", 7, "#15191e")} />
          <div style={imgBox(20)} />
          <div style={row}>
            <div style={col}>
              <div style={bar("45%", 3, "#c8102e")} />
              <div style={bar("100%")} />
              <div style={bar("80%")} />
            </div>
            <div style={col}>
              <div style={bar("45%", 3, "#c8102e")} />
              <div style={bar("100%")} />
              <div style={bar("75%")} />
            </div>
          </div>
        </>
      );
      break;
    case "visual_edition":
      body = (
        <>
          <div style={imgBox(26)} />
          <div style={row}>
            <div style={col}>
              <div style={imgBox(16)} />
              <div style={bar("90%")} />
            </div>
            <div style={col}>
              <div style={imgBox(16)} />
              <div style={bar("85%")} />
            </div>
          </div>
        </>
      );
      break;
    case "deep_dive":
      body = (
        <div style={{ background: "#23262b", borderRadius: 3, padding: 7, height: "100%" }}>
          <div style={bar("60%", 6, "#f0ede6")} />
          <div style={imgBox(16)} />
          <div style={bar("40%", 3, "#c8a45d")} />
          <div style={bar("95%", 3, "#a8a396")} />
          <div style={bar("80%", 3, "#a8a396")} />
        </div>
      );
      break;
    case "data_brief":
      body = (
        <>
          <div style={row}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...col, background: "#eceae4", borderRadius: 3, padding: 4 }}>
                <div style={bar("60%", 3, "#7a808a")} />
                <div style={bar("80%", 5, "#15191e")} />
              </div>
            ))}
          </div>
          <div style={bar("70%")} />
          <div style={bar("90%")} />
          <div style={bar("55%")} />
        </>
      );
      break;
    case "readers_edition":
      body = (
        <>
          <div style={imgBox(16)} />
          <div style={bar("85%")} />
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ ...col, border: "1px solid #c8102e", borderRadius: 3, height: 12 }} />
            <div style={{ ...col, border: "1px solid #d8d3c8", borderRadius: 3, height: 12 }} />
            <div style={{ ...col, border: "1px solid #d8d3c8", borderRadius: 3, height: 12 }} />
          </div>
        </>
      );
      break;
    case "minimalist":
      body = (
        <>
          <div style={bar("35%", 5, "#15191e")} />
          <div style={bar("96%")} />
          <div style={bar("100%")} />
          <div style={bar("88%")} />
          <div style={bar("98%")} />
          <div style={bar("30%", 3, "#c8102e")} />
        </>
      );
      break;
    default: // daily_digest
      body = (
        <>
          <div style={imgBox(26)} />
          <div style={bar("80%", 5, "#15191e")} />
          <div style={row}>
            <div style={imgBox(18)} />
            <div style={col}>
              <div style={bar("50%", 3, "#c8102e")} />
              <div style={bar("100%")} />
              <div style={bar("75%")} />
            </div>
          </div>
        </>
      );
  }
  return <div style={wrap} aria-hidden="true">{body}</div>;
}
