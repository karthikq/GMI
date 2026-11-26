import { client, connect } from "./db.js";
import { seedCategories } from "./seed.js";

// Non-destructive: upserts the canonical section/subsection tree. Existing
// categories, flags, SEO fields and all articles are left untouched.
await connect();
const counts = await seedCategories();
console.log(
  `Category tree synced: ${counts.sections} sections, ${counts.subsections} subsections.`,
);
await client.close();
