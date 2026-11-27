// Shared Good Morning Indian email design system. Every format is built from
// these primitives — table layouts and inline CSS only, so the markup survives
// Gmail, Outlook and every preview renderer. No grid, no scripts, no forms.
//
// Design tokens (editorial branding):
//   max width 600px · outer #E9E7E1 · editorial #FAF9F5 · ink #15191E
//   red accent #C8102E · Georgia headlines · Arial 15–16px body, line-height 1.6
//   content padding 24px

import type { CSSProperties } from "react";
import type { EditionContent, EditionStory, MarketRow } from "@/lib/editionContent";

export const T = {
  outer: "#E9E7E1",
  paper: "#FAF9F5",
  ink: "#15191E",
  red: "#C8102E",
  soft: "#4a5059",
  mute: "#7a808a",
  line: "#d8d3c8",
  card: "#ffffff",
  charcoal: "#23262b",
  gold: "#c8a45d",
  serif: "Georgia,'Times New Roman',serif",
  sans: "Arial,Helvetica,sans-serif",
  width: 600,
  pad: 24,
};

// Two-column cells stack on narrow clients. Kept tiny and Gmail-safe:
// class selectors only, no pseudo-elements, one media query.
export const RESPONSIVE_CSS = `
.em-col{width:50%;vertical-align:top}
@media (max-width:620px){
.em-col{display:block !important;width:100% !important;padding-left:0 !important;padding-right:0 !important}
.em-card{margin-bottom:16px !important}
}`;

const kicker: CSSProperties = {
  fontFamily: T.sans,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "1.6px",
  textTransform: "uppercase",
  color: T.red,
};

export function Kicker({ children, color }: { children: React.ReactNode; color?: string }) {
  return <p style={{ ...kicker, margin: 0, ...(color ? { color } : {}) }}>{children}</p>;
}

// Thin editorial divider — a bordered table cell, email-safe.
export function Divider({ heavy, space = 18 }: { heavy?: boolean; space?: number }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ padding: `${space}px 0` }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ borderTop: `1px solid ${T.ink}`, fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                </tr>
                {heavy && (
                  <tr>
                    <td style={{ borderTop: `3px solid ${T.ink}`, paddingTop: 2, fontSize: 0, lineHeight: 0 }}>
                      &nbsp;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReadMore({ href, dark }: { href: string; dark?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: T.sans,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.6px",
        color: dark ? T.gold : T.red,
        textDecoration: "none",
      }}
    >
      Read more →
    </a>
  );
}

export function Cta({ href, label, dark }: { href: string; label: string; dark?: boolean }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "20px auto" }}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              background: dark ? T.gold : T.red,
              borderRadius: 2,
              padding: "12px 30px",
            }}
          >
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: T.sans,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              {label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// An email-safe image with accessible alt text; render nothing (rather than a
// broken icon) when a story has no usable image.
export function StoryImage({
  story,
  width,
  caption,
  credit,
  link = true,
}: {
  story: EditionStory;
  width: number;
  caption?: boolean;
  credit?: boolean;
  link?: boolean;
}) {
  if (!story.image) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={story.image}
      alt={story.title}
      width={width}
      style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto", border: 0 }}
    />
  );
  return (
    <div>
      {link && story.url ? (
        <a href={story.url} target="_blank" rel="noopener noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      {(caption && story.caption) || (credit && story.imageCredit) ? (
        <p
          style={{
            margin: "6px 0 0",
            fontFamily: T.sans,
            fontSize: 11,
            lineHeight: 1.4,
            color: T.mute,
          }}
        >
          {caption && story.caption ? story.caption : ""}
          {caption && story.caption && credit && story.imageCredit ? " · " : ""}
          {credit && story.imageCredit ? `Credit: ${story.imageCredit}` : ""}
        </p>
      ) : null}
    </div>
  );
}

// Accessible fallback for image-first formats when a story has no image: a
// bordered cell carrying the category so the gallery slot isn't blank.
export function ImageFallback({ story, height = 150 }: { story: EditionStory; height?: number }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              height,
              background: "#efece4",
              border: `1px solid ${T.line}`,
              fontFamily: T.sans,
              fontSize: 11,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: T.mute,
              verticalAlign: "middle",
            }}
          >
            {story.tag}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReadTime({ story }: { story: EditionStory }) {
  return (
    <span style={{ fontFamily: T.sans, fontSize: 11, color: T.mute }}>
      {story.readMinutes} min read
    </span>
  );
}

// ── Optional blocks (never counted toward the minimum five stories) ────────

// Market snapshot + text-based bar chart — the table IS the accessible
// alternative; bars are a nested table cell sized to the change.
export function MarketSnapshot({ rows, source, asOf }: { rows: MarketRow[]; source?: string; asOf?: string }) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.change)), 0.5);
  const stamp = asOf
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(asOf))
    : null;
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
      <tbody>
        <tr>
          <td style={{ background: T.card, border: `1px solid ${T.line}`, padding: "14px 16px" }}>
            <Kicker>Market snapshot</Kicker>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 8 }}>
              <tbody>
                {rows.map((row) => {
                  const pct = Math.min(100, Math.round((Math.abs(row.change) / maxAbs) * 100));
                  return (
                    <tr key={row.name}>
                      <td style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, padding: "5px 0", width: "34%" }}>
                        {row.name}
                      </td>
                      <td style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, color: T.ink, padding: "5px 8px", width: "24%" }}>
                        {row.value}
                      </td>
                      <td
                        style={{
                          fontFamily: T.sans,
                          fontSize: 13,
                          fontWeight: 700,
                          color: row.change >= 0 ? "#0f7a4d" : T.red,
                          padding: "5px 8px",
                          width: "14%",
                        }}
                      >
                        {row.change >= 0 ? "+" : ""}
                        {row.change.toFixed(2)}%
                      </td>
                      <td style={{ padding: "5px 0" }}>
                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td
                                width={`${pct}%`}
                                style={{ background: row.change >= 0 ? "#0f7a4d" : T.red, fontSize: 0, lineHeight: 0, height: 8 }}
                              >
                                &nbsp;
                              </td>
                              <td style={{ fontSize: 0, lineHeight: 0 }}>&nbsp;</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ margin: "8px 0 0", fontFamily: T.sans, fontSize: 10, color: T.mute }}>
              {source ? `Source: ${source}` : "Source: market data"}
              {stamp ? ` · as of ${stamp}` : ""} · figures may be delayed
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function FactBox({ fact }: { fact: string }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
      <tbody>
        <tr>
          <td
            style={{
              background: T.card,
              borderLeft: `3px solid ${T.red}`,
              padding: "12px 16px",
            }}
          >
            <Kicker>Interesting fact</Kicker>
            <p style={{ margin: "6px 0 0", fontFamily: T.serif, fontSize: 14, fontStyle: "italic", lineHeight: 1.5, color: T.ink }}>
              {fact}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EditorsNote({ note, dark }: { note: string; dark?: boolean }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
      <tbody>
        <tr>
          <td
            style={{
              background: dark ? "#2b2f35" : "#f2efe7",
              border: `1px solid ${dark ? "#3a3f47" : T.line}`,
              padding: "14px 18px",
            }}
          >
            <Kicker color={dark ? T.gold : undefined}>Editor&rsquo;s note</Kicker>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: T.serif,
                fontSize: 14,
                fontStyle: "italic",
                lineHeight: 1.55,
                color: dark ? "#d9d5cc" : T.ink,
              }}
            >
              {note}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function WhyItMatters({ text, dark }: { text: string; dark?: boolean }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "14px 0" }}>
      <tbody>
        <tr>
          <td
            style={{
              borderTop: `2px solid ${dark ? T.gold : T.red}`,
              borderBottom: `1px solid ${dark ? "#3a3f47" : T.line}`,
              padding: "12px 2px",
            }}
          >
            <Kicker color={dark ? T.gold : undefined}>Why it matters</Kicker>
            <p
              style={{
                margin: "6px 0 0",
                fontFamily: T.sans,
                fontSize: 14,
                lineHeight: 1.6,
                color: dark ? "#d9d5cc" : T.soft,
              }}
            >
              {text}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ActionList({
  title,
  kicker: label,
  question,
  options,
  dark,
}: {
  title?: string;
  kicker: string;
  question: string;
  options: { label: string; href: string }[];
  dark?: boolean;
}) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0" }}>
      <tbody>
        <tr>
          <td style={{ background: dark ? "#2b2f35" : T.card, border: `1px solid ${dark ? "#3a3f47" : T.line}`, padding: "16px" }}>
            <Kicker color={dark ? T.gold : undefined}>{label}</Kicker>
            {title ? (
              <p style={{ margin: "4px 0 0", fontFamily: T.sans, fontSize: 11, color: T.mute }}>{title}</p>
            ) : null}
            <p
              style={{
                margin: "8px 0 10px",
                fontFamily: T.serif,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.4,
                color: dark ? "#f0ede6" : T.ink,
              }}
            >
              {question}
            </p>
            {options.map((option) => (
              <a
                key={option.href}
                href={option.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  margin: "6px 0",
                  padding: "10px 14px",
                  border: `1px solid ${dark ? "#4a5059" : T.line}`,
                  borderRadius: 3,
                  fontFamily: T.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: dark ? T.gold : T.red,
                  textDecoration: "none",
                }}
              >
                {option.label}
              </a>
            ))}
            <p style={{ margin: "8px 0 0", fontFamily: T.sans, fontSize: 10, color: T.mute }}>
              Opens on goodmorningindian.in — no sign-in needed.
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export const PollBlock = ({ poll, dark }: { poll: NonNullable<EditionContent["extras"]["poll"]>; dark?: boolean }) => (
  <ActionList kicker="Reader poll" question={poll.question} options={poll.options} dark={dark} />
);

export const QuizBlock = ({ quiz, dark }: { quiz: NonNullable<EditionContent["extras"]["quiz"]>; dark?: boolean }) => (
  <ActionList kicker="Daily quiz" title="Answer on the site" question={quiz.question} options={quiz.options} dark={dark} />
);

// ── Shell: masthead + footer wrapping every format ─────────────────────────

export type ShellProps = {
  c: EditionContent;
  logoSrc?: string;
  unsubscribeUrl?: string;
  dark?: boolean;
  children: React.ReactNode;
};

function metaCell(text: string, align: "left" | "right" | "center", dark?: boolean) {
  return (
    <td
      align={align}
      style={{
        fontFamily: T.sans,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1.4px",
        textTransform: "uppercase",
        color: dark ? T.gold : T.mute,
        padding: "6px 0",
      }}
    >
      {text}
    </td>
  );
}

export function EmailShell({ c, logoSrc, unsubscribeUrl, dark, children }: ShellProps) {
  const bg = dark ? T.charcoal : T.paper;
  const ink = dark ? "#f0ede6" : T.ink;
  const rule = dark ? T.gold : T.ink;
  const link = dark ? T.gold : T.red;
  return (
    <div style={{ background: T.outer, padding: "16px 8px", margin: 0 }}>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ maxWidth: T.width, margin: "0 auto", background: bg, border: `1px solid ${dark ? "#3a3f47" : T.line}` }}
      >
        <tbody>
          {/* Masthead */}
          <tr>
            <td style={{ padding: `${T.pad}px ${T.pad}px 0` }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td align="center" style={{ paddingBottom: 14 }}>
                      {logoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoSrc} alt="Good Morning Indian" width={210} style={{ display: "block", margin: "0 auto", border: 0 }} />
                      ) : (
                        <span
                          style={{
                            fontFamily: T.serif,
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            color: ink,
                          }}
                        >
                          Good Morning Indian
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td
                      align="center"
                      style={{
                        borderTop: `2px solid ${rule}`,
                        borderBottom: `1px solid ${rule}`,
                        padding: "7px 0",
                        fontFamily: T.serif,
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        color: ink,
                      }}
                    >
                      {c.letterName}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ borderBottom: `1px solid ${rule}` }}>
                      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                        <tbody>
                          <tr>
                            {metaCell(c.volNumber ?? "GMI EDITION", "left", dark)}
                            {metaCell(c.editionDate, "center", dark)}
                            {metaCell("Reported with care", "right", dark)}
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {/* Body */}
          <tr>
            <td style={{ padding: `18px ${T.pad}px ${T.pad}px` }}>{children}</td>
          </tr>
          {/* Footer */}
          <tr>
            <td
              style={{
                borderTop: `2px solid ${rule}`,
                padding: "16px 24px 22px",
                fontFamily: T.sans,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.6, color: dark ? "#b9b4a8" : T.mute }}>
                You&rsquo;re receiving this email because you subscribed to {c.letterName}.
              </p>
              <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.8 }}>
                <a href={`${c.siteUrl}/newsletters`} style={{ color: link, textDecoration: "none", fontWeight: 700 }}>
                  Manage preferences
                </a>
                {"  ·  "}
                <a href={unsubscribeUrl ?? `${c.siteUrl}/newsletters`} style={{ color: link, textDecoration: "none", fontWeight: 700 }}>
                  Unsubscribe
                </a>
              </p>
              <p style={{ margin: 0, fontSize: 11, color: dark ? "#8a857a" : T.mute }}>
                © {new Date().getFullYear()} Good Morning Indian · Reported with care
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
