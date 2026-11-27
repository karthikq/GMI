// Pure scheduling math for the newsletter delivery engine — no I/O so it can
// be unit-tested. All timestamps are UTC instant (Date); a template's schedule
// is expressed in its own IANA zone and recipients can override the time in
// theirs.

export type ScheduleKind = "daily" | "weekdays" | "weekly" | "trading" | "event";

export type Schedule = {
  kind: ScheduleKind;
  // weekly only — 0 = Sunday … 6 = Saturday (matches Date#getDay).
  dayOfWeek?: number;
  // "HH:MM" 24-hour, in `timeZone`.
  time: string;
  timeZone: string;
};

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
export const SCHEDULE_KINDS: ScheduleKind[] = ["daily", "weekdays", "weekly", "trading", "event"];

export const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

// NSE/BSE trading-day holidays. Kept small and overrideable via env so the
// ops team can update without a deploy: NSE_HOLIDAYS="2026-01-26,2026-03-03,…"
const NSE_HOLIDAYS_2026 = [
  "2026-01-26", // Republic Day
  "2026-03-04", // Holi (Dhuleti trade holiday region)
  "2026-03-26", // Shri Ram Navami
  "2026-03-31", // Mahavir Jayanti
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Ambedkar Jayanti
  "2026-04-21", // Id-ul-Fitr (approx)
  "2026-05-01", // Maharashtra Day
  "2026-05-28", // Bakri Id (approx)
  "2026-06-26", // Muharram (approx)
  "2026-09-14", // Ganesh Chaturthi (approx)
  "2026-10-02", // Gandhi Jayanti
  "2026-10-20", // Dussehra (approx)
  "2026-11-10", // Diwali (Laxmi Pujan, approx)
  "2026-11-11", // Diwali Balipratipada (approx)
  "2026-11-24", // Gurunanak Jayanti (approx)
  "2026-12-25", // Christmas
];

export const tradingHolidays: ReadonlySet<string> = new Set(
  (process.env.NSE_HOLIDAYS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .concat(NSE_HOLIDAYS_2026),
);

export function timeZoneOrDefault(zone: unknown): string {
  const value = typeof zone === "string" && zone.trim() ? zone.trim() : DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// The local wall-clock parts of `instant` in `timeZone`.
export function localParts(
  timeZone: string,
  instant: Date,
): { date: string; time: string; weekday: number; epoch: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // Approximate local epoch (good enough for weekday arithmetic — wall-clock
  // interpretation of the zoned fields).
  const epoch = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(hour),
    Number(get("minute")),
  );
  return { date, time: `${hour}:${get("minute")}`, weekday: new Date(epoch).getUTCDay(), epoch };
}

// Convert "HH:MM on localDate in timeZone" to a UTC instant. Iterates once:
// offset is computed from the wall-clock guess, then applied.
export function localToUtc(localDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parts = localParts(timeZone, guess);
  const guessLocal = Date.UTC(
    Number(parts.date.slice(0, 4)),
    Number(parts.date.slice(5, 7)) - 1,
    Number(parts.date.slice(8, 10)),
    Number(parts.time.slice(0, 2)),
    Number(parts.time.slice(3, 5)),
  );
  const offset = guessLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

// Days covered by a schedule kind. `dates` are local dates "YYYY-MM-DD".
export function scheduleCoversDate(schedule: Schedule, localDate: string): boolean {
  const [y, m, d] = localDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  switch (schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
    case "trading":
      if (weekday === 0 || weekday === 6) return false;
      if (schedule.kind === "trading" && tradingHolidays.has(localDate)) return false;
      return true;
    case "weekly":
      return weekday === (schedule.dayOfWeek ?? 1);
    case "event":
      return false; // event editions are created explicitly, not calendar-driven
  }
}

// ISO week "YYYY-Www" for weekly edition periods.
export function weekKey(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// The edition-period key a send belongs to: local date for daily cadences,
// ISO week for weekly, explicit keys for event editions.
export function periodKey(schedule: Schedule, localDate: string): string {
  return schedule.kind === "weekly" ? weekKey(localDate) : localDate;
}

const DAY_MS = 86_400_000;

// Scan backwards from `now` for schedule-covered local dates whose send time
// is due-or-overdue, inside `catchUpHours`. Returns newest-first candidates
// (the caller turns each into an edition + deliveries). For weekly cadences
// the covered send-day is the schedule's weekday inside the containing week.
export function dueSlots(
  schedule: Schedule,
  now: Date,
  opts: { catchUpHours: number; lookbackDays?: number },
): { localDate: string; periodKey: string; scheduledAt: Date; missed: boolean }[] {
  if (schedule.kind === "event" || !TIME_RE.test(schedule.time)) return [];
  const zone = timeZoneOrDefault(schedule.timeZone);
  const horizonMs = opts.catchUpHours * 3_600_000;
  const out: { localDate: string; periodKey: string; scheduledAt: Date; missed: boolean }[] = [];
  const local = localParts(zone, now);
  const seenPeriods = new Set<string>();
  const [cy, cm, cd] = local.date.split("-").map(Number);
  const todayEpoch = Date.UTC(cy, cm - 1, cd);

  for (let i = 0; i <= (opts.lookbackDays ?? 14); i++) {
    const date = new Date(todayEpoch - i * DAY_MS).toISOString().slice(0, 10);
    if (!scheduleCoversDate(schedule, date)) continue;
    const scheduledAt = localToUtc(date, schedule.time, zone);
    const overdue = now.getTime() - scheduledAt.getTime();
    if (overdue < 0) continue; // not yet due — earlier dates may still be owed
    const key = periodKey(schedule, date);
    if (seenPeriods.has(key)) continue; // weekly: only newest covered day per period
    seenPeriods.add(key);
    // Beyond the catch-up window the slot is surfaced as missed — recorded,
    // never silently dropped, and the admin can still retry it manually.
    out.push({ localDate: date, periodKey: key, scheduledAt, missed: overdue > horizonMs });
  }
  return out;
}

// A recipient's own send instant for an edition — their time override in
// their zone on the edition's local date, else the template default.
export function recipientSendAt(
  template: { time: string; timeZone: string },
  subscriber: { time?: string; timeZone?: string },
  localDate: string,
): Date {
  const time = TIME_RE.test(subscriber.time ?? "") ? subscriber.time! : template.time;
  const zone = TIME_RE.test(subscriber.time ?? "")
    ? timeZoneOrDefault(subscriber.timeZone)
    : timeZoneOrDefault(template.timeZone);
  return localToUtc(localDate, time, zone);
}

// Derives a Schedule from a legacy cadence string ("Weekdays before 7am",
// "Every Friday", "Weekdays at 6pm", "Trading days", "Daily").
const CADENCE_DAY: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

export function scheduleFromCadence(cadence: string): Schedule {
  const upper = cadence.toUpperCase();
  const match = cadence.match(/(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)/i);
  let time = "08:00";
  if (match) {
    let hour = parseInt(match[1], 10) % 12;
    if (match[2].toLowerCase().startsWith("p")) hour += 12;
    time = `${String(hour).padStart(2, "0")}:00`;
  }
  if (upper.includes("TRADING")) return { kind: "trading", time, timeZone: DEFAULT_TIME_ZONE };
  if (upper.includes("EVENT") || upper.includes("BREAKING")) {
    return { kind: "event", time, timeZone: DEFAULT_TIME_ZONE };
  }
  const named = Object.keys(CADENCE_DAY).find((day) => upper.includes(day));
  if (named) return { kind: "weekly", dayOfWeek: CADENCE_DAY[named], time, timeZone: DEFAULT_TIME_ZONE };
  if (upper.includes("WEEKDAY")) return { kind: "weekdays", time, timeZone: DEFAULT_TIME_ZONE };
  return { kind: "daily", time, timeZone: DEFAULT_TIME_ZONE };
}
