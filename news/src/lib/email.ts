import { readFileSync } from "node:fs";
import path from "node:path";
import type { Newsletter } from "./newsletters";
import { NEWSLETTERS } from "./newsletters";
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

// A delivered newsletter issue, rendered from the letter's sample edition.
// Table-free inline styling so it renders sanely in most mail clients.
function newsletterIssueHtml(
  letter: Newsletter,
  issueDate: string,
  logoUrl: string,
  siteUrl: string,
): string {
  const s = letter.sample;
  const quote = s.quote
    ? `<div style="margin:24px 0;padding:18px 20px;border-left:3px solid #c8102e;background:#eceae4">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${escape(s.quote.kicker)}</p>
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:17px;font-style:italic;line-height:1.4;color:#14171c">&ldquo;${escape(s.quote.text)}&rdquo;</p>
        <p style="margin:0;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">${escape(s.quote.attribution)}</p>
      </div>`
    : "";
  const stories = s.stories
    .map(
      (story) => `<div style="margin:0 0 18px;padding-bottom:18px;border-bottom:1px solid #dcdad3">
        <img src="${escape(story.image)}" alt="" width="512" style="display:block;width:100%;max-width:512px;margin-bottom:10px" />
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${escape(story.tag)}</p>
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:18px;font-weight:700;line-height:1.25;color:#14171c">${escape(story.title)}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#4a5059">${escape(story.summary)}</p>
      </div>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f4f0">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px 40px;font-family:Arial,Helvetica,sans-serif;color:#14171c">
    <img src="${logoUrl}" alt="Good Morning Indian" width="170" style="display:block;margin-bottom:20px" />
    <div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #dcdad3;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">
      <span>${escape(s.topBannerLeft || letter.name)}</span>
      <span>${escape(issueDate)}</span>
    </div>
    <p style="margin:14px 0 2px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#7a808a">${escape(s.volNumber)}</p>
    <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c8102e">${escape(s.subHeader)}</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:1.15;color:#14171c">${escape(s.headline)}</h1>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4a5059">${escape(s.leadDek)}</p>
    ${quote}
    ${stories}
    <div style="margin:24px 0;text-align:center">
      <a href="${siteUrl}" style="display:inline-block;padding:12px 28px;background:#14171c;color:#f5f4f0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">${escape(s.ctaText)}</a>
    </div>
    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7a808a">${escape(s.footerTag)}</p>
    <p style="margin:0;font-size:11px;line-height:1.6;color:#7a808a">
      You&rsquo;re receiving ${escape(letter.name)} ${escape(letter.cadence.toLowerCase())} ·
      <a href="${siteUrl}/newsletters" style="color:#c8102e">Manage newsletters</a>
    </p>
  </div>
</body></html>`;
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
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[email] BREVO_API_KEY not set — skipped "${subject}" to ${to}`);
    return "skipped";
  }
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
    }),
  });
  if (!response.ok) {
    console.warn(`[email] "${subject}" to ${to} failed: ${response.status} ${await response.text()}`);
    return "failed";
  }
  return "sent";
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
): Promise<SendStatus> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  const status = await sendViaBrevo(
    to,
    undefined,
    `${letter.name} — ${issueDate}`,
    newsletterIssueHtml(letter, issueDate, logo.src, siteUrl),
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
