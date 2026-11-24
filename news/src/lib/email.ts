import { readFileSync } from "node:fs";
import path from "node:path";

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

// Sends a transactional email via Brevo. No-ops (with a log) when
// BREVO_API_KEY isn't configured, so local dev doesn't fail.
async function sendViaBrevo(
  to: string,
  name: string | undefined,
  subject: string,
  html: string,
  attachment?: { content: string; name: string }[],
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[email] BREVO_API_KEY not set — skipped "${subject}" to ${to}`);
    return;
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
        name:  "Good Morning Indian",
        email:  "jskarthik10@gmail.com",
      },
      to: [{ email: to, ...(name ? { name } : {}) }],
      subject,
      htmlContent: html,
      ...(attachment ? { attachment } : {}),
    }),
  });
  if (!response.ok) {
    console.warn(`[email] "${subject}" to ${to} failed: ${response.status} ${await response.text()}`);
  }
}

// Sends the welcome email via Brevo's transactional API. No-ops (with a log)
// when BREVO_API_KEY isn't configured, so local dev doesn't fail.
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  await sendViaBrevo(to, name, "Welcome to Good Morning Indian", welcomeHtml(name, logo.src), logo.attachment);
}

// Confirms a newsletter subscription. Only call when the letter was newly
// added (queries report `added`), so repeat clicks don't resend it.
export async function sendNewsletterConfirmEmail(
  to: string,
  letterName: string,
  cadence: string,
): Promise<void> {
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const logo = logoForEmail(siteUrl);
  await sendViaBrevo(
    to,
    undefined,
    `You're subscribed to ${letterName}`,
    newsletterConfirmHtml(letterName, cadence, logo.src, siteUrl),
    logo.attachment,
  );
}
