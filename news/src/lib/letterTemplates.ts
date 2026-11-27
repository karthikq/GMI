// Newsletter templates: the persistent counterpart of the NEWSLETTERS
// catalogue. The code constants seed the `letterTemplates` collection
// (idempotent, $setOnInsert); after that the collection is the source of
// truth for scheduling/config so admin edits take effect without deploys.
// The constants still provide marketing copy (sample issue, tagline, blurb).

import { EMAIL_FORMATS, NEWSLETTERS, type Newsletter } from "./newsletters";
import {
  SCHEDULE_KINDS,
  TIME_RE,
  scheduleFromCadence,
  timeZoneOrDefault,
  type Schedule,
  type ScheduleKind,
} from "./scheduler";

export type EmptyPolicy = "skip" | "send-with-fallback" | "hold";

export type LetterTemplate = {
  // Same id space as NEWSLETTERS (`letters[]` on subscribers references it).
  id: string;
  name: string;
  description: string;
  cadence: string; // human-readable ("Every Friday") — kept for display
  schedule: Schedule;
  topics: string[]; // editorial desks → sections used for content
  deskSlug?: string; // desk letters: the section slug they map to
  articleCount: number;
  formats: string[]; // EmailFormat ids the reader may pick
  premium: boolean;
  active: boolean;
  // What to do when the edition has fewer than minArticles fresh stories.
  onEmpty: EmptyPolicy;
  minArticles: number;
  createdAt?: Date;
  updatedAt?: Date;
};

// Sensible defaults when the admin form leaves a field unset.
const DEFAULT_FORMATS = EMAIL_FORMATS.map((format) => format.id);

function fromConstant(letter: Newsletter): LetterTemplate {
  return {
    id: letter.id,
    name: letter.name,
    description: letter.blurb,
    cadence: letter.cadence,
    schedule: { ...scheduleFromCadence(letter.cadence), time: "07:30" },
    topics: letter.topics,
    articleCount: 6,
    formats: DEFAULT_FORMATS,
    premium: Boolean(letter.premium),
    active: true,
    onEmpty: "send-with-fallback",
    minArticles: 1,
  };
}

// The 12 additional editions, seeded inactive until an admin enables them.
type NewTemplate = {
  id: string;
  name: string;
  cadence: string;
  schedule: Schedule;
  topics: string[];
  deskSlug?: string;
  blurb: string;
};

const EXTRA_TEMPLATES: NewTemplate[] = [
  { id: "evening", name: "The Evening Edition", cadence: "Daily at 7pm", schedule: { kind: "daily", time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["India", "World", "Business"], blurb: "The day's story, closed out — what happened and what it means tonight." },
  { id: "markets-open", name: "Markets Open", cadence: "Trading days at 8:30am", schedule: { kind: "trading", time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Markets", "Business", "Economy"], deskSlug: "markets", blurb: "Pre-open cues, overnight moves and the numbers to watch before the bell." },
  { id: "business-brief", name: "The Business Brief", cadence: "Weekdays at 8am", schedule: { kind: "weekdays", time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Business", "Economy"], deskSlug: "business", blurb: "Companies, deals and the economy — every weekday morning." },
  { id: "political-brief", name: "The Political Brief", cadence: "Every Wednesday", schedule: { kind: "weekly", dayOfWeek: 3, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Politics"], deskSlug: "politics", blurb: "The week in power, policy and the people behind both." },
  { id: "sports-roundup", name: "The Sports Roundup", cadence: "Daily at 8am", schedule: { kind: "daily", time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Sports"], deskSlug: "sports", blurb: "Scores, fixtures and the stories behind the games — daily." },
  { id: "tech-dispatch", name: "The Tech Dispatch", cadence: "Every Tuesday", schedule: { kind: "weekly", dayOfWeek: 2, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Technology"], deskSlug: "technology", blurb: "Product launches, research and the industry moves that matter." },
  { id: "cinema-edit", name: "The Cinema Edit", cadence: "Every Friday", schedule: { kind: "weekly", dayOfWeek: 5, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Entertainment"], deskSlug: "entertainment", blurb: "Releases, reviews and the week on screen — for Friday evening." },
  { id: "science-journal", name: "The Science Journal", cadence: "Every Thursday", schedule: { kind: "weekly", dayOfWeek: 4, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Science"], deskSlug: "science", blurb: "Peer-reviewed and plain-spoken — the week in research." },
  { id: "weekend-escape", name: "The Weekend Escape", cadence: "Every Saturday", schedule: { kind: "weekly", dayOfWeek: 6, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Travel", "Lifestyle"], deskSlug: "travel", blurb: "Trips, tables and slow weekends — planned by Saturday tea." },
  { id: "health-edit", name: "The Health Edit", cadence: "Every Monday", schedule: { kind: "weekly", dayOfWeek: 1, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Health"], deskSlug: "health", blurb: "Medicine, wellness and evidence you can act on — Mondays." },
  { id: "sunday-read", name: "The Sunday Read", cadence: "Every Sunday", schedule: { kind: "weekly", dayOfWeek: 0, time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["Longform", "Culture"], blurb: "One unhurried morning of the week's best writing." },
  { id: "breaking", name: "Breaking News Alerts", cadence: "Event based", schedule: { kind: "event", time: "07:30", timeZone: "Asia/Kolkata" }, topics: ["India", "World"], blurb: "Only when it can't wait — major stories as they break." },
];

export const EXTRA_TEMPLATE_IDS = new Set(EXTRA_TEMPLATES.map((t) => t.id));

// Templates seeded into Mongo: every code-defined letter active, plus the
// new editions inactive pending admin review.
export function seedTemplates(): LetterTemplate[] {
  return [
    ...NEWSLETTERS.map(fromConstant),
    ...EXTRA_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.blurb,
      cadence: t.cadence,
      schedule: t.schedule,
      topics: t.topics,
      ...(t.deskSlug ? { deskSlug: t.deskSlug } : {}),
      articleCount: 6,
      formats: DEFAULT_FORMATS,
      premium: false,
      active: false, // new templates stay off until an admin enables them
      onEmpty: "send-with-fallback" as EmptyPolicy,
      minArticles: 1,
    })),
  ];
}

// The display-side Newsletter for a template: the constant entry when the id
// is a code-defined letter, otherwise a generated sample so preview/email
// rendering still works for admin-created templates.
export function newsletterForTemplate(template: LetterTemplate): Newsletter {
  const existing = NEWSLETTERS.find((item) => item.id === template.id);
  if (existing) return existing;
  return {
    id: template.id,
    name: template.name,
    tagline: template.cadence,
    cadence: template.cadence,
    blurb: template.description,
    topics: template.topics,
    premium: template.premium,
    sample: {
      volNumber: "GMI EDITION",
      date: template.cadence.toUpperCase(),
      topBannerLeft: template.name.toUpperCase(),
      topBannerRight: "REPORTED WITH CARE",
      subHeader: template.description.toUpperCase(),
      headline: "This edition is being prepared.",
      leadDek: template.description,
      stories: [],
      ctaText: `Read ${template.name} →`,
      footerTag: "INFORM / INSPIRE / EMPOWER",
    },
  };
}

// Validates an admin template form; returns the clean template fields or an
// error string. `id` may be absent for create (generated from the name).
export function sanitizeTemplateInput(
  input: unknown,
): (Omit<LetterTemplate, "createdAt" | "updatedAt"> & { id: string }) | { error: string } {
  if (!input || typeof input !== "object") return { error: "Nothing to save." };
  const raw = input as Record<string, unknown>;
  const name = String(raw.name ?? "").trim();
  if (name.length < 3 || name.length > 80) return { error: "Give the newsletter a name (3–80 characters)." };
  const slugBase = String(raw.id ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!slugBase) return { error: "Couldn't make an id from that name." };

  const rawSchedule = (raw.schedule ?? {}) as Record<string, unknown>;
  const kind = SCHEDULE_KINDS.includes(rawSchedule.kind as ScheduleKind)
    ? (rawSchedule.kind as ScheduleKind)
    : null;
  if (!kind) return { error: "Pick a valid schedule." };
  const time = String(rawSchedule.time ?? "");
  if (!TIME_RE.test(time)) return { error: "Delivery time must be HH:MM (24-hour)." };
  const timeZone = timeZoneOrDefault(rawSchedule.timeZone);
  const dayOfWeek =
    kind === "weekly"
      ? Math.min(Math.max(Math.floor(Number(rawSchedule.dayOfWeek) || 0), 0), 6)
      : undefined;

  const topics = Array.isArray(raw.topics)
    ? raw.topics.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
    : [];
  const formats = Array.isArray(raw.formats)
    ? raw.formats.filter((f): f is string => EMAIL_FORMATS.some((item) => item.id === f))
    : [];
  if (!formats.length) return { error: "Pick at least one supported format." };
  const onEmpty: EmptyPolicy =
    raw.onEmpty === "skip" || raw.onEmpty === "hold" ? raw.onEmpty : "send-with-fallback";

  return {
    id: String(raw.id ?? slugBase),
    name,
    description: String(raw.description ?? "").trim().slice(0, 300),
    cadence: String(raw.cadence ?? "").trim().slice(0, 80) || "Daily",
    schedule: { kind, ...(dayOfWeek !== undefined ? { dayOfWeek } : {}), time, timeZone },
    topics,
    ...(typeof raw.deskSlug === "string" && raw.deskSlug ? { deskSlug: raw.deskSlug } : {}),
    articleCount: Math.min(Math.max(Math.floor(Number(raw.articleCount)) || 6, 1), 12),
    formats,
    premium: raw.premium === true,
    active: raw.active === true,
    onEmpty,
    minArticles: Math.min(Math.max(Math.floor(Number(raw.minArticles)) || 1, 0), 10),
  };
}
