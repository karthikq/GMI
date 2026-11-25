import { collections, connect } from "./db";
import { sendNewsletterIssueEmail } from "./email";
import { NEWSLETTERS } from "./newsletters";

const DAY_LONG = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Readers who never picked a time are evaluated in this zone. India-first
// product, so Asia/Kolkata is the sane default; DELIVERY_TZ overrides it.
const DEFAULT_TZ = process.env.DELIVERY_TZ || "Asia/Kolkata";

// Does a letter with this cadence go out on `weekday` ("MONDAY"…"SUNDAY")?
// Cadences are either a named weekday ("Every Friday") or "Weekdays …".
export function letterSendsOn(cadence: string, weekday: string): boolean {
  const upper = cadence.toUpperCase();
  const named = DAY_LONG.find((day) => upper.includes(day));
  if (named) return weekday === named;
  if (upper.includes("WEEKDAY")) return weekday !== "SATURDAY" && weekday !== "SUNDAY";
  return true;
}

// The letter's built-in send time, parsed out of the cadence copy
// ("Weekdays before 7am" → "07:00", "Weekdays at 6pm" → "18:00").
export function defaultSendTime(cadence: string): string {
  const match = cadence.match(/(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)/i);
  if (match) {
    let hour = parseInt(match[1], 10) % 12;
    if (match[2].toLowerCase().startsWith("p")) hour += 12;
    return `${String(hour).padStart(2, "0")}:00`;
  }
  return "08:00";
}

// "FRI, NOV 28, 2026" from "2026-11-28" — the date stamped on the issue.
function issueDateLabel(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_LONG[date.getUTCDay()].slice(0, 3)}, ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

// The subscriber-local "now": which weekday/date/time it is in their zone.
function localNow(timeZone: string, now: Date): { weekday: string; date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    weekday: get("weekday").toUpperCase(),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

export type DeliveryRun = {
  scanned: number;
  due: number;
  sent: number;
  failed: number;
  errors: string[];
};

// One pipeline tick: every subscriber × letter that is due right now gets the
// issue email. A letter is due when its cadence covers the subscriber's local
// weekday and their local time has passed the send time (reader's letterTimes
// override, else the cadence's own time). letterLastSent makes the tick
// idempotent — a letter goes out at most once per local day per address, so
// the cron can run often without double-sending.
export async function deliverDueNewsletters(now = new Date()): Promise<DeliveryRun> {
  await connect();
  const run: DeliveryRun = { scanned: 0, due: 0, sent: 0, failed: 0, errors: [] };
  const cursor = collections.subscribers.find({ "letters.0": { $exists: true } });

  for await (const sub of cursor) {
    run.scanned += 1;
    const timeZone = typeof sub.timeZone === "string" && sub.timeZone ? sub.timeZone : DEFAULT_TZ;
    let local;
    try {
      local = localNow(timeZone, now);
    } catch {
      local = localNow(DEFAULT_TZ, now);
    }

    for (const id of Array.isArray(sub.letters) ? sub.letters : []) {
      const letter = NEWSLETTERS.find((item) => item.id === id);
      if (!letter) continue;
      const dueTime = sub.letterTimes?.[id] ?? defaultSendTime(letter.cadence);
      if (
        !letterSendsOn(letter.cadence, local.weekday) ||
        local.time < dueTime ||
        sub.letterLastSent?.[id] === local.date
      ) {
        continue;
      }
      run.due += 1;
      try {
        const status = await sendNewsletterIssueEmail(sub.email, letter, issueDateLabel(local.date));
        if (status === "failed") {
          run.failed += 1;
          run.errors.push(`${sub.email}/${id}: provider rejected the send`);
          continue;
        }
        // "skipped" (no API key in dev) still marks the day so every cron tick
        // doesn't re-log the same no-op send.
        await collections.subscribers.updateOne(
          { _id: sub._id },
          { $set: { [`letterLastSent.${id}`]: local.date } },
        );
        run.sent += 1;
      } catch (error) {
        run.failed += 1;
        run.errors.push(`${sub.email}/${id}: ${error instanceof Error ? error.message : "send failed"}`);
      }
    }
  }
  return run;
}

export type DeliverNowResult = { status: "sent" | "skipped" | "failed" } | { error: string };

// Manual send for one subscriber/letter pair — the admin dashboard's "Send
// now" button. Ignores the cadence schedule entirely, but the delivery log
// and letterLastSent update exactly like a scheduled tick so the chip flips
// to its real status and the next cron run stays consistent.
export async function deliverLetterNow(
  emailField: string,
  letterId: string,
  now = new Date(),
): Promise<DeliverNowResult> {
  await connect();
  const letter = NEWSLETTERS.find((item) => item.id === letterId);
  if (!letter) return { error: "Unknown newsletter." };
  const email = String(emailField || "").trim().toLowerCase();
  const sub = await collections.subscribers.findOne({ email });
  if (!sub) return { error: "That address isn't on the subscriber list." };
  if (!(Array.isArray(sub.letters) && sub.letters.includes(letterId))) {
    return { error: `${letter.name} isn't enabled for this reader.` };
  }
  const timeZone = typeof sub.timeZone === "string" && sub.timeZone ? sub.timeZone : DEFAULT_TZ;
  let local;
  try {
    local = localNow(timeZone, now);
  } catch {
    local = localNow(DEFAULT_TZ, now);
  }
  const status = await sendNewsletterIssueEmail(sub.email, letter, issueDateLabel(local.date));
  if (status !== "failed") {
    await collections.subscribers.updateOne(
      { _id: sub._id },
      { $set: { [`letterLastSent.${letterId}`]: local.date } },
    );
  }
  return { status };
}
