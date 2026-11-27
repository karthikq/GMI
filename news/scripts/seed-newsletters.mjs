// Idempotent newsletter-template seed. Safe to run any number of times —
// existing documents are never overwritten ($setOnInsert only), so admin
// edits survive re-runs.
//
//   MONGODB_URI=... MONGODB_DB=meridian node scripts/seed-newsletters.mjs
//
// The app also runs this automatically inside connect() on first use; the
// script exists for provisioning pipelines that want an explicit step.
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "meridian";

const tz = "Asia/Kolkata";
const FMTS = ["daily", "classic", "corporate", "heritage", "scrapbook", "storefront", "skyline", "digest"];

const LEGACY = [
  ["briefing", "The Morning Briefing", "Weekdays before 7am", { kind: "weekdays", time: "07:00", timeZone: tz }, ["World", "Business", "Culture"], false, true],
  ["pulse", "AI Weekly Pulse", "Every Friday", { kind: "weekly", dayOfWeek: 5, time: "08:00", timeZone: tz }, ["People", "Technology", "Policy", "Business"], true, true],
  ["markets", "Markets Close", "Weekdays at 6pm", { kind: "weekdays", time: "18:00", timeZone: tz }, ["Indices", "Commodities", "Currencies"], true, true],
  ["world", "The World Weekly", "Every Sunday", { kind: "weekly", dayOfWeek: 0, time: "08:00", timeZone: tz }, ["World", "Politics", "Economy"], true, true],
  ["weekend", "Weekend Longform", "Every Saturday", { kind: "weekly", dayOfWeek: 6, time: "08:00", timeZone: tz }, ["Longform", "Culture", "In Pictures"], true, true],
  ["india", "India This Week", "Every Saturday", { kind: "weekly", dayOfWeek: 6, time: "08:00", timeZone: tz }, ["India", "Politics", "Education"], true, true],
];

const EXTRA = [
  ["evening", "The Evening Edition", "Daily at 7pm", { kind: "daily", time: "19:00", timeZone: tz }, ["India", "World", "Business"], "The day's story, closed out."],
  ["markets-open", "Markets Open", "Trading days at 8:30am", { kind: "trading", time: "08:30", timeZone: tz }, ["Markets", "Business", "Economy"], "Pre-open cues before the bell."],
  ["business-brief", "The Business Brief", "Weekdays at 8am", { kind: "weekdays", time: "08:00", timeZone: tz }, ["Business", "Economy"], "Companies, deals and the economy — every weekday."],
  ["political-brief", "The Political Brief", "Every Wednesday", { kind: "weekly", dayOfWeek: 3, time: "08:00", timeZone: tz }, ["Politics"], "The week in power and policy."],
  ["sports-roundup", "The Sports Roundup", "Daily at 8am", { kind: "daily", time: "08:00", timeZone: tz }, ["Sports"], "Scores, fixtures and the stories behind the games."],
  ["tech-dispatch", "The Tech Dispatch", "Every Tuesday", { kind: "weekly", dayOfWeek: 2, time: "09:00", timeZone: tz }, ["Technology"], "Launches, research and industry moves."],
  ["cinema-edit", "The Cinema Edit", "Every Friday", { kind: "weekly", dayOfWeek: 5, time: "17:00", timeZone: tz }, ["Entertainment"], "Releases and reviews — for Friday evening."],
  ["science-journal", "The Science Journal", "Every Thursday", { kind: "weekly", dayOfWeek: 4, time: "09:00", timeZone: tz }, ["Science"], "The week in research, plain-spoken."],
  ["weekend-escape", "The Weekend Escape", "Every Saturday", { kind: "weekly", dayOfWeek: 6, time: "08:00", timeZone: tz }, ["Travel", "Lifestyle"], "Trips, tables and slow weekends."],
  ["health-edit", "The Health Edit", "Every Monday", { kind: "weekly", dayOfWeek: 1, time: "08:00", timeZone: tz }, ["Health"], "Medicine and wellness, evidence first."],
  ["sunday-read", "The Sunday Read", "Every Sunday", { kind: "weekly", dayOfWeek: 0, time: "10:00", timeZone: tz }, ["Longform", "Culture"], "One unhurried morning of the week's best writing."],
  ["breaking", "Breaking News Alerts", "Event based", { kind: "event", time: "08:00", timeZone: tz }, ["India", "World"], "Only when it can't wait."],
];

const DESK_IDS = [
  "politics", "business", "science", "sports", "culture", "lifestyle", "health",
  "education", "environment", "travel", "automobile", "gaming", "opinion",
  "in-pictures", "economy",
];

const now = new Date();
const client = new MongoClient(uri);
await client.connect();
try {
  const db = client.db(dbName);
  const templates = db.collection("letterTemplates");

  const doc = ([id, name, cadence, schedule, topics, x, active]) => ({
    id,
    name,
    description: typeof x === "string" ? x : "",
    cadence,
    schedule,
    topics,
    articleCount: 6,
    formats: FMTS,
    premium: x === true,
    active: typeof active === "boolean" ? active : false,
    onEmpty: "send-with-fallback",
    minArticles: 1,
    createdAt: now,
    updatedAt: now,
  });

  let seeded = 0;
  for (const entry of LEGACY) {
    const r = await templates.updateOne({ id: entry[0] }, { $setOnInsert: doc(entry) }, { upsert: true });
    if (r.upsertedCount) seeded++;
  }
  for (const entry of EXTRA) {
    const r = await templates.updateOne({ id: entry[0] }, { $setOnInsert: doc(entry) }, { upsert: true });
    if (r.upsertedCount) seeded++;
  }
  for (const id of DESK_IDS) {
    await templates.updateOne(
      { id },
      {
        $setOnInsert: {
          id,
          name: id,
          description: "",
          cadence: "Weekly",
          schedule: { kind: "weekly", dayOfWeek: 1, time: "08:00", timeZone: tz },
          topics: [id],
          deskSlug: id,
          articleCount: 6,
          formats: FMTS,
          premium: true,
          active: true,
          onEmpty: "send-with-fallback",
          minArticles: 1,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Seed complete — ${seeded} new templates inserted, existing documents untouched.`);
} finally {
  await client.close();
}
