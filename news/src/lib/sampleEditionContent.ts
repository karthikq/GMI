import type { EditionContent, EditionStory } from "./editionContent";
import type { Newsletter } from "./newsletters";

// Sample content for previews — every preview shows at least five stories
// drawn from the letter's canned sample, plus illustrative optional blocks so
// the subscriber sees the complete format before choosing it. Kept separate
// from editionContent.ts so client components (the format picker modal) can
// build a preview without bundling the server-only queries/db imports.
export function sampleEditionContent(letter: Newsletter, siteUrl: string, issueDate?: string): EditionContent {
  const stories: EditionStory[] = letter.sample.stories.map((story, i) => ({
    slug: `sample-${i}`,
    tag: story.tag,
    title: story.title,
    summary: story.summary,
    url: story.url ?? siteUrl,
    ...(story.image ? { image: story.image } : {}),
    caption: `${story.tag.toLowerCase()} desk photograph`,
    imageCredit: "GMI staff",
    readMinutes: 3 + (i % 3),
    lead: `${story.summary} This sample preview shows how the full edition reads.`,
    whyItMatters:
      i === 0
        ? "The outcome shapes policy and markets well beyond this week's headlines — a story worth returning to."
        : undefined,
    author: "Sample desk",
  }));
  return {
    letterName: letter.name,
    editionDate: issueDate ?? letter.sample.date,
    ...(letter.sample.volNumber ? { volNumber: letter.sample.volNumber } : {}),
    siteUrl,
    stories,
    extras: {
      markets: [
        { name: "Nifty 50", value: "24,812.40", change: 0.2 },
        { name: "Sensex", value: "81,340.90", change: 0.38 },
        { name: "Brent crude", value: "$81.34", change: -0.73 },
        { name: "Gold", value: "$2,388.00", change: 0.31 },
      ],
      marketsSource: "Sample figures",
      marketsAsOf: new Date().toISOString(),
      fact: "India's first newspaper, Hicky's Bengal Gazette, rolled off the press in 1780.",
      editorsNote:
        "A note from the editor on what we're watching this week — shown here when your desk writes one.",
      ...(letter.sample.quote
        ? { quote: { text: letter.sample.quote.text, attribution: letter.sample.quote.attribution } }
        : {}),
      poll: {
        question: "Which desk should we expand next?",
        options: ["Climate", "Technology", "Culture", "Sport"].map((label, i) => ({
          label,
          href: `${siteUrl}/engage/poll?l=${encodeURIComponent(letter.id)}&o=${i}`,
        })),
      },
      quiz: {
        question: "Which city hosts the country's oldest stock exchange?",
        options: ["Mumbai", "Kolkata", "Chennai", "Delhi"].map((label, i) => ({
          label,
          href: `${siteUrl}/engage/quiz?l=${encodeURIComponent(letter.id)}&o=${i}`,
        })),
      },
    },
  };
}
