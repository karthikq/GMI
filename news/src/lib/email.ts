import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import EmailSheet from "@/components/EmailSheets";
import { EMAIL_SKIN_CSS } from "./emailSkinsCss";
import { articlesBySlugs, buildIssueLetter, letterFromArticles } from "./issue";
import type { Newsletter } from "./newsletters";
import { EMAIL_FORMATS, NEWSLETTERS } from "./newsletters";
import type { Plan } from "./plans";
import { recordDelivery } from "./queries";

const TAGLINE = "World · Business · Culture — Reported with care";
const escape = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// The logo travels inside the email as an inline attachment (cid:logo.png) so
// clients render it even when SITE_URL isn't publicly reachable — a localhost
// URL can't be fetched by Gmail's image proxy.
let logoBase64: string | null | undefined;
function logoContent(): string | null {
  if (logoBase64 === undefined) {
    try {
      logoBase64 = readFileSync(path.join(process.cwd(), "public", "logo.png")).toString("base64");
    } catch {
      logoBase64 = null;
    }
  }
  return logoBase64;
}

function logoForEmail(siteUrl: string): { src: string; attachment?: { content: string; name: string }[] } {
  const content = logoContent();
  return content
    ? { src: "cid:logo.png", attachment: [{ content, name: "logo.png" }] }
    : { src: `${siteUrl}/logo.png` };
}

function welcomeHtml(name: string, logoUrl: string): string {
  const safeName = escape(name);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f4f0">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Arial,Helvetica,sans-serif;color:#14171c">
    <img src="${logoUrl}" alt="Good Morning Indian" width="190" style="display:block;margin-bottom:28px" />
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${TAGLINE}</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:600">Welcome, ${safeName}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4a5059">
      Thanks for joining Good Morning Indian. Your account is ready — dive into
      today's edition, follow the desks you care about, and save the stories
      that matter to you.
    </p>
    <div style="margin:28px 0;padding:22px;border:1px solid #dcdad3;background:#ffffff;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">Your welcome gift</p>
      <p style="margin:6px 0;font-size:15px;color:#4a5059">Get <strong>15% off</strong> any Premium plan with code</p>
      <p style="margin:10px 0;font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#c8102e">gmi15</p>
      <p style="margin:0;font-size:12px;color:#7a808a">Enter it when you choose a plan on the subscription page.</p>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a808a">
      See you in the morning briefing,<br />The Good Morning Indian team
    </p>
  </div>
</body></html>`;
}

function newsletterConfirmHtml(letterName: string, cadence: string, logoUrl: string, siteUrl: string): string {
  const safeName = escape(letterName);
  const safeCadence = escape(cadence);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f4f0">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Arial,Helvetica,sans-serif;color:#14171c">
    <img src="${logoUrl}" alt="Good Morning Indian" width="190" style="display:block;margin-bottom:28px" />
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${TAGLINE}</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:600">You&rsquo;re subscribed.</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4a5059">
      Thanks for joining <strong>${safeName}</strong>. Your first edition is on
      its way — keep an eye on your inbox.
    </p>
    <div style="margin:28px 0;padding:22px;border:1px solid #dcdad3;background:#ffffff;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">Your newsletter</p>
      <p style="margin:6px 0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#14171c">${safeName}</p>
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7a808a">Arrives ${safeCadence}</p>
    </div>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#7a808a">
      Changed your mind? Manage your picks any time on the
      <a href="${siteUrl}/newsletters" style="color:#c8102e">newsletters page</a>.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a808a">
      See you in your inbox,<br />The Good Morning Indian team
    </p>
  </div>
</body></html>`;
}

function planConfirmHtml(name: string, plan: Plan, siteUrl: string, logoUrl: string): string {
  const safeName = escape(name);
  const features = plan.features
    .filter((feature) => feature.included)
    .map(
      (feature) =>
        `<li style="margin:0 0 8px;font-size:14px;color:#4a5059">&#10003;&nbsp; ${escape(feature.text)}</li>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f4f0">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Arial,Helvetica,sans-serif;color:#14171c">
    <img src="${logoUrl}" alt="Good Morning Indian" width="190" style="display:block;margin-bottom:28px" />
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${TAGLINE}</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:600">Welcome to ${escape(plan.name)}, ${safeName}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4a5059">
      Your subscription is active — everything in your plan is unlocked from
      this edition onward. Thanks for supporting independent journalism.
    </p>
    <div style="margin:28px 0;padding:22px;border:1px solid #dcdad3;background:#ffffff;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">Your plan</p>
      <p style="margin:6px 0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#14171c">${escape(plan.name)}</p>
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7a808a">${escape(plan.price)} · ${escape(plan.term)}</p>
      <ul style="margin:16px 0 0;padding:0;list-style:none;text-align:left">
        ${features}
      </ul>
    </div>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#7a808a">
      Desk-edition newsletters are included now — pick yours on the
      <a href="${siteUrl}/newsletters" style="color:#c8102e">newsletters page</a>,
      and manage or cancel your plan any time from
      <a href="${siteUrl}/profile" style="color:#c8102e">your profile</a>.
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7a808a">
      See you in the morning,<br />The Good Morning Indian team
    </p>
  </div>
</body></html>`;
}

// What happened to an attempted send, recorded on the deliveries collection so
// the admin dashboard can show it. "skipped" means the local dev no-op.
export type SendStatus = "sent" | "skipped" | "failed";

// Gmail discards a <style> block once the combined embedded CSS passes
// 16,384 characters, so each email embeds only its own skin plus the shared
// footer. Custom properties are resolved to literals because Gmail and
// Outlook drop declarations containing var(), which would leave the mail unstyled.
const CSS_VARS: Record<string, string> = {
  "--paper": "#f5f4f0",
  "--surface": "#ffffff",
  "--ink": "#14171c",
  "--ink-soft": "#4a5059",
  "--ink-mute": "#7a808a",
  "--line": "#dcdad3",
  "--accent": "#c8102e",
  "--accent-dark": "#9a0c23",
  "--live": "#d9381e",
  "--up": "#0f7a4d",
  "--band": "#eceae4",
  "--panel": "#14171c",
  "--font-sans": "Arial, Helvetica, sans-serif",
  "--font-mono": "'Courier New', Courier, monospace",
  "--font-display": "Georgia, 'Times New Roman', serif",
  "--font-heading": "Arial, Helvetica, sans-serif",
  "--font-geometric": "Arial, Helvetica, sans-serif",
};

// flex, grid, clamp(), min()/max(), gap and aspect-ratio are dropped by Gmail
// and Outlook, collapsing every layout. Downgrade them: flex/grid → block so
// children stack, clamp/min/max → their first (minimum) value, then restore
// horizontal rhythm where spans ran together via EMAIL_PATCH.
const EMAIL_PATCH = `
.fmt-daily-meta span,.fmt-daily-foot span,.fmt-her-top span,.fmt-her-access span,
.fmt-sky-top span,.fmt-sky-top i,.fmt-store-head span,.fmt-dig-top span,
.email-sheet-top span,.email-sheet-bar span,.fmt-corp-kicker span,.fmt-corp-kicker i,
.fmt-sfoot-links span{display:inline-block;margin-right:14px;vertical-align:middle}
.email-sheet-foot>div,.fmt-store-foot>div{display:inline-block;margin:0 22px 8px 0;vertical-align:top}
img{max-width:100%;height:auto}`;

// Gmail discards the ENTIRE <style> block when it meets a selector it can't
// parse — pseudo-classes/elements (:hover, ::before, :first-child), attribute
// selectors, the ~ sibling combinator, or non-media at-rules. The skin CSS
// contains several, so rules are filtered one by one; anything left keeps
// working instead of taking down the whole stylesheet.
const UNSAFE_SELECTOR = /[:[\]~]/;

type CssBlock = { selector: string; text: string };

function topLevelBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const n = css.length;
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (i >= n) break;
    const start = i;
    let brace = -1;
    for (let j = i; j < n; j++) {
      if (css.startsWith("/*", j)) {
        const end = css.indexOf("*/", j);
        j = end < 0 ? n - 1 : end + 1;
        continue;
      }
      if (css[j] === "{") {
        brace = j;
        break;
      }
      if (css[j] === ";") {
        i = j + 1;
        break;
      }
    }
    if (brace < 0) break;
    const selector = css.slice(start, brace).trim();
    let depth = 1;
    let j = brace + 1;
    for (; j < n; j++) {
      if (css.startsWith("/*", j)) {
        const end = css.indexOf("*/", j);
        j = end < 0 ? n - 1 : end + 1;
        continue;
      }
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (!depth) {
          j++;
          break;
        }
      }
    }
    blocks.push({ selector, text: css.slice(start, j) });
    i = j;
  }
  return blocks;
}

function sanitizeForEmail(css: string): string {
  const kept: string[] = [];
  for (const block of topLevelBlocks(css)) {
    if (block.selector.startsWith("@")) {
      if (!/^@media\b/i.test(block.selector)) continue;
      const inner = block.text.slice(block.text.indexOf("{") + 1, block.text.lastIndexOf("}"));
      const keptInner = sanitizeForEmail(inner);
      if (keptInner) kept.push(`${block.selector}{${keptInner}}`);
      continue;
    }
    if (!UNSAFE_SELECTOR.test(block.selector)) kept.push(block.text);
  }
  return kept.join("\n");
}

const SKIN_CSS_PREFIXES: Record<string, string[]> = {
  daily: [".fmt-sheet", ".fmt-daily", ".fmt-sfoot"],
  classic: [
    ".email-sheet",
    ".email-lead",
    ".email-cup",
    ".email-quote",
    ".email-story",
    ".email-foot",
    ".email-cta",
    ".fmt-sfoot",
  ],
  corporate: [".fmt-sheet", ".fmt-corp", ".fmt-sfoot"],
  heritage: [".fmt-sheet", ".fmt-heritage", ".fmt-her", ".fmt-sfoot"],
  scrapbook: [".fmt-sheet", ".fmt-scrap", ".fmt-sfoot"],
  storefront: [".fmt-sheet", ".fmt-store", ".fmt-sfoot"],
  skyline: [".fmt-sheet", ".fmt-sky", ".fmt-sfoot"],
  digest: [".fmt-sheet", ".fmt-digest", ".fmt-dig", ".fmt-sfoot"],
};

function filterCssForSkin(css: string, skin: string): string {
  const prefixes = SKIN_CSS_PREFIXES[skin] ?? SKIN_CSS_PREFIXES.daily;
  const kept: string[] = [];
  for (const block of topLevelBlocks(css)) {
    if (block.selector.startsWith("@")) {
      if (!/^@media\b/i.test(block.selector)) continue;
      const inner = block.text.slice(block.text.indexOf("{") + 1, block.text.lastIndexOf("}"));
      const keptInner = filterCssForSkin(inner, skin);
      if (keptInner) kept.push(`${block.selector}{${keptInner}}`);
      continue;
    }
    if (block.selector === "img" || prefixes.some((prefix) => block.selector.includes(prefix))) {
      kept.push(block.text);
    }
  }
  return kept.join("\n");
}

const minifiedSkinCss: Record<string, string> = {};
function emailSkinCss(skin: string): string {
  if (!minifiedSkinCss[skin]) {
    const compiled = `${EMAIL_SKIN_CSS}${EMAIL_PATCH}`
      .replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_match, name, fallback) =>
        String(CSS_VARS[name as string] ?? fallback ?? "inherit"),
      )
      .replace(/clamp\(\s*([^,)]+),[^)]*\)/g, "$1")
      .replace(/(?:min|max)\(\s*([^,)]+),[^)]*\)/g, "$1")
      .replace(/display\s*:\s*(?:inline-)?(?:flex|grid)/g, "display:block");
    minifiedSkinCss[skin] = sanitizeForEmail(filterCssForSkin(compiled, skin))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>])\s*/g, "$1")
      .trim();
  }
  return minifiedSkinCss[skin];
}

// A delivered newsletter issue: real stories rendered in the format the reader
// picked on /newsletters. The same EmailSheet skins used by the preview are
// rendered to static markup and styled by the embedded skin CSS.
async function newsletterIssueHtml(
  letter: Newsletter,
  issueDate: string,
  format: string | undefined,
  logoUrl: string,
  siteUrl: string,
): Promise<string> {
  const skin = EMAIL_FORMATS.some((item) => item.id === format) ? String(format) : "daily";
  const issueLetter = await buildIssueLetter(letter, issueDate, siteUrl);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    createElement(EmailSheet, { format: skin, letter: issueLetter, issueDate, siteUrl }),
  ).replace(/src="\/logo\.png"/g, `src="${logoUrl}"`);
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${emailSkinCss(skin)}</style>
</head><body style="margin:0;padding:0;background:#f5f4f0">
<div style="max-width:640px;margin:0 auto">${body}</div>
</body></html>`;
}

export type BrevoResult = {
  // "sent" 2xx with messageId · "failed" definitive rejection · "skipped" no
  // API key (dev) · "ambiguous" timeout/network failure where the provider
  // may already hold the message — never auto-resend those.
  outcome: "sent" | "failed" | "skipped" | "ambiguous";
  messageId?: string;
  providerStatus?: number;
  providerCode?: string;
  detail?: string;
  retryable: boolean;
  retryAfterSec?: number;
};

// Sends a transactional email via Brevo and reports everything the queue
// needs: message id for webhooks, Retry-After for rate limits, and a timeout
// so a hung provider can't stall the scheduler run.
async function sendViaBrevoDetailed(
  to: string,
  name: string | undefined,
  subject: string,
  html: string,
  attachment?: { content: string; name: string }[],
  extra?: { tags?: string[]; headers?: Record<string, string> },
): Promise<BrevoResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[email] BREVO_API_KEY not set — skipped "${subject}" to ${to}`);
    return { outcome: "skipped", detail: "BREVO_API_KEY not configured.", retryable: false };
  }
  // EMAIL_DRY_RUN=true renders and records everything but never calls Brevo —
  // use it for development and smoke tests so no real mail leaves the account.
  if (process.env.EMAIL_DRY_RUN === "true") {
    console.log(`[email] dry run — skipped "${subject}" to ${to}`);
    return { outcome: "skipped", detail: "EMAIL_DRY_RUN", retryable: false };
  }
  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME ?? "Good Morning Indian",
          email: process.env.BREVO_SENDER_EMAIL ?? "jskarthik10@gmail.com",
        },
        to: [{ email: to, ...(name ? { name } : {}) }],
        subject,
        htmlContent: html,
        ...(attachment ? { attachment } : {}),
        ...(extra?.tags ? { tags: extra.tags } : {}),
        ...(extra?.headers ? { headers: extra.headers } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    // Timeout or network failure — the request may still have landed. The
    // caller marks this ambiguous and reconciles instead of resending.
    return {
      outcome: "ambiguous",
      detail: error instanceof Error ? error.message : "network failure",
      retryable: false,
    };
  }
  const retryAfter = Number(response.headers.get("retry-after"));
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let code: string | undefined;
    try {
      code = JSON.parse(body)?.code;
    } catch {}
    const retryable = response.status === 429 || response.status >= 500;
    console.warn(`[email] "${subject}" to ${to} failed: ${response.status} ${body}`);
    return {
      outcome: "failed",
      providerStatus: response.status,
      providerCode: code,
      detail: `Brevo ${response.status}${code ? ` ${code}` : ""}: ${body.slice(0, 200)}`,
      retryable,
      retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    };
  }
  let messageId: string | undefined;
  try {
    messageId = (await response.json())?.messageId;
  } catch {}
  return { outcome: "sent", messageId, providerStatus: response.status, retryable: false };
}

// Sends a transactional email via Brevo. No-ops (with a log) when
// BREVO_API_KEY isn't configured, so local dev doesn't fail.
async function sendViaBrevo(
  to: string,
  name: string | undefined,
  subject: string,
  html: string,
  attachment?: { content: string; name: string }[],
): Promise<SendStatus> {
  const result = await sendViaBrevoDetailed(to, name, subject, html, attachment);
  return result.outcome === "ambiguous" ? "failed" : result.outcome;
}

// Sends the welcome email via Brevo's transactional API. No-ops (with a log)
// when BREVO_API_KEY isn't configured, so local dev doesn't fail.
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  await sendViaBrevo(to, name, "Welcome to Good Morning Indian", welcomeHtml(name, logo.src), logo.attachment);
}

// Confirms a newsletter subscription. Only call when the letter was newly
// added (queries report `added`), so repeat clicks don't resend it. The send
// outcome lands on the deliveries collection for the admin dashboard.
export async function sendNewsletterConfirmEmail(to: string, letterId: string): Promise<void> {
  const letter = NEWSLETTERS.find((item) => item.id === letterId);
  if (!letter) return;
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  const status = await sendViaBrevo(
    to,
    undefined,
    `You're subscribed to ${letter.name}`,
    newsletterConfirmHtml(letter.name, letter.cadence, logo.src, siteUrl),
    logo.attachment,
  );
  try {
    await recordDelivery(to, letter.id, status);
  } catch {}
}

// Delivers one newsletter issue. Called by the delivery cron once the letter
// is due for this address; same-day dedupe happens in the caller via
// letterLastSent. Returns the send status so the cron can count outcomes.
export async function sendNewsletterIssueEmail(
  to: string,
  letter: Newsletter,
  issueDate: string,
  format?: string,
): Promise<SendStatus> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  const status = await sendViaBrevo(
    to,
    undefined,
    `${letter.name} — ${issueDate}`,
    await newsletterIssueHtml(letter, issueDate, format, logo.src, siteUrl),
    logo.attachment,
  );
  try {
    await recordDelivery(to, letter.id, status, "issue");
  } catch {}
  return status;
}

// Confirms a paid-plan activation. Sent only when reconcileSubscription first
// flips a mandate to ACTIVE, so webhook/callback retries don't re-mail the
// reader. No-ops in dev without BREVO_API_KEY.
export async function sendPlanConfirmEmail(to: string, name: string, plan: Plan): Promise<void> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  await sendViaBrevo(
    to,
    name,
    `You're on ${plan.name} — subscription active`,
    planConfirmHtml(name, plan, siteUrl, logo.src),
    logo.attachment,
  );
}

// ── Edition sends + unsubscribe links ──────────────────────────────────────

const unsubSecret = () =>
  process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.BREVO_API_KEY || "gmi-dev";

// Signed, unguessable unsubscribe target — no login required. The token binds
// the address to the letter so a leaked link can't unsubscribe anything else.
export function unsubscribeToken(email: string, letterId: string): string {
  return createHmac("sha256", unsubSecret())
    .update(`${email.toLowerCase()}|${letterId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function unsubscribeUrl(email: string, letterId: string): string {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const params = new URLSearchParams({ e: email.toLowerCase(), l: letterId, t: unsubscribeToken(email, letterId) });
  return `${siteUrl}/unsubscribe?${params}`;
}

function subscriptionFooterHtml(siteUrl: string, unsubscribe: string): string {
  return `<div style="max-width:640px;margin:0 auto;padding:18px 24px;font-family:Arial,Helvetica,sans-serif">
  <p style="margin:0;font-size:11px;line-height:1.6;color:#7a808a">
    You are receiving this because you subscribed to Good Morning Indian newsletters.
    <a href="${unsubscribe}" style="color:#c8102e">Unsubscribe from this newsletter</a> ·
    <a href="${siteUrl}/newsletters" style="color:#c8102e">Manage your newsletters</a>
  </p>
</div>`;
}

// Renders the issue for a frozen edition — the articles stored at generation
// time, never "whatever is newest now". Exported for the admin preview.
export async function editionIssueHtml(
  letter: Newsletter,
  edition: { editionDate: string; articleSlugs: string[] },
  format: string | undefined,
  logoUrl: string,
  siteUrl: string,
  unsubscribe: string,
): Promise<string> {
  const skin = EMAIL_FORMATS.some((item) => item.id === format) ? String(format) : "daily";
  const articles = await articlesBySlugs(edition.articleSlugs).catch(() => []);
  const issueLetter = letterFromArticles(letter, articles, edition.editionDate, siteUrl);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    createElement(EmailSheet, { format: skin, letter: issueLetter, issueDate: edition.editionDate, siteUrl }),
  ).replace(/src="\/logo\.png"/g, `src="${logoUrl}"`);
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${emailSkinCss(skin)}</style>
</head><body style="margin:0;padding:0;background:#f5f4f0">
<div style="max-width:640px;margin:0 auto">${body}</div>
${subscriptionFooterHtml(siteUrl, unsubscribe)}
</body></html>`;
}

// The queue-facing send: renders a stored edition, tags the send with the
// delivery id (returned verbatim in Brevo webhook events) and attaches
// List-Unsubscribe headers for client-level opt-out.
export async function sendEditionEmail(input: {
  to: string;
  name?: string;
  letter: Newsletter;
  edition: { id: string; editionDate: string; articleSlugs: string[] };
  format?: string;
  deliveryId: string;
  letterId: string;
}): Promise<BrevoResult> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  const unsubscribe = unsubscribeUrl(input.to, input.letterId);
  const html = await editionIssueHtml(
    input.letter,
    input.edition,
    input.format,
    logo.src,
    siteUrl,
    unsubscribe,
  );
  return sendViaBrevoDetailed(
    input.to,
    input.name,
    `${input.letter.name} — ${input.edition.editionDate}`,
    html,
    logo.attachment,
    {
      tags: [`delivery:${input.deliveryId}`, `letter:${input.letterId}`],
      headers: {
        "List-Unsubscribe": `<${unsubscribe}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Delivery-Id": input.deliveryId,
      },
    },
  );
}
