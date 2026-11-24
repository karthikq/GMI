// The newsletters readers can subscribe to. `id` is stored on the subscriber's
// `letters` array in Mongo, so keep ids stable once they ship.

// Email template options for the example-email preview. The first entry is the
// default and the only free format; every other format is a paid plan perk.
// `id` is stored on the subscriber's `format` field, so keep ids stable.
export type EmailFormat = {
  id: string;
  name: string;
  style: string;
  premium: boolean;
};

export const EMAIL_FORMATS: EmailFormat[] = [
  { id: "daily", name: "Daily Edition", style: "Black & white front page", premium: false },
  { id: "classic", name: "Classic Broadsheet", style: "Vintage front page", premium: true },
  { id: "corporate", name: "Corporate Report", style: "White, navy & orange business", premium: true },
  { id: "heritage", name: "Heritage Print", style: "Old-school club gazette", premium: true },
  { id: "scrapbook", name: "Scrapbook Post", style: "Collage & sticky notes", premium: true },
  { id: "storefront", name: "Storefront Weekly", style: "Modern promo magazine", premium: true },
  { id: "skyline", name: "Skyline Dispatch", style: "Dark navy company summary", premium: true },
  { id: "digest", name: "Modern Digest", style: "Clean numbered briefing", premium: true },
];

// The issue date shown in email previews, computed from the cadence so it
// always reads as a real upcoming issue, e.g. "FRI, NOV 28, 2026".
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_LONG = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function nextIssueDate(cadence: string, from = new Date()): string {
  const upper = cadence.toUpperCase();
  const named = DAY_LONG.findIndex((day) => upper.includes(day));
  let offset = 0; // daily cadences → today
  if (named >= 0) {
    offset = (named - from.getDay() + 7) % 7;
  } else if (upper.includes("WEEKDAY")) {
    // Next weekday: Fri → Mon, Sat → Mon, Sun → Mon, else today.
    offset = [1, 0, 0, 0, 0, 3, 2][from.getDay()];
  }
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export type SampleStory = {
  tag: string;
  title: string;
  summary: string;
  image: string;
};

export type SampleEmail = {
  volNumber: string;
  date: string;
  topBannerLeft: string;
  topBannerRight: string;
  subHeader: string;
  headline: string;
  leadDek: string;
  quote?: {
    kicker: string;
    text: string;
    attribution: string;
  };
  stories: SampleStory[];
  ctaText: string;
  footerTag: string;
};

export type Newsletter = {
  id: string;
  name: string;
  tagline: string;
  cadence: string;
  blurb: string;
  topics: string[];
  featured?: boolean;
  sample: SampleEmail;
};

const FLAGSHIP_NEWSLETTERS: Newsletter[] = [
  {
    id: "briefing",
    name: "The Morning Briefing",
    tagline: "The day, before it starts",
    cadence: "Weekdays before 7am",
    blurb:
      "The five stories that matter, the markets at a glance and one piece worth your full attention. No ads.",
    topics: ["World", "Business", "Culture"],
    featured: true,
    sample: {
      volNumber: "VOL. 4 · ISSUE 289",
      date: "TUESDAY, NOV 24, 2026",
      topBannerLeft: "THE MORNING BRIEFING",
      topBannerRight: "REPORTED WITH CARE",
      subHeader: "YOUR ESSENTIAL FIVE-MINUTE WORLD & NATIONAL BRIEFING",
      headline: "Global Energy Summit Reaches Milestone Grid Pact.",
      leadDek:
        "Forty nations commit to cross-border clean power corridors as regional grids link up to balance solar and wind surges.",
      quote: {
        kicker: "First Coffee Thought",
        text: "Clarity in the morning sets the cadence for the day.",
        attribution: "BEFORE 7AM. EVERY WEEKDAY.",
      },
      stories: [
        {
          tag: "WORLD",
          title: "Alpine Nations Ratify Joint Glacier Reservoir Treaty",
          summary:
            "Five governments agree on seasonal water quotas, unlocking delayed green hydro projects.",
          image: "https://picsum.photos/seed/glacier-water/600/380",
        },
        {
          tag: "BUSINESS",
          title: "Semiconductor Foundries Post Record Output",
          summary:
            "New fabrication lines in Gujarat and Dresden hit peak yields two quarters ahead of plan.",
          image: "https://picsum.photos/seed/semiconductor-chip/600/380",
        },
        {
          tag: "CULTURE",
          title: "Restored 1920s News Archives Open to Public",
          summary:
            "Over two million scanned broadsheets and field dispatches now freely searchable online.",
          image: "https://picsum.photos/seed/newspaper-press/600/380",
        },
      ],
      ctaText: "Read Today's Briefing →",
      footerTag: "ACCURATE / INDEPENDENT / ESSENTIAL",
    },
  },
  {
    id: "pulse",
    name: "AI Weekly Pulse",
    tagline: "A smarter tomorrow",
    cadence: "Every Friday",
    blurb:
      "Your weekly brief on AI, tech and what comes next — from breakthrough research to real-world impact.",
    topics: ["People", "Technology", "Policy", "Business"],
    sample: {
      volNumber: "VOL. 1 · NO. 12",
      date: "SEP 17, 2026",
      topBannerLeft: "A SMARTER TOMORROW",
      topBannerRight: "SAME TECH. BIGGER POSSIBILITIES.",
      subHeader: "YOUR WEEKLY BRIEF ON AI, TECH AND WHAT COMES NEXT",
      headline: "Bigger Ideas. A More Intelligent Tomorrow.",
      leadDek:
        "Your weekly briefing on the most important developments in AI — from breakthrough research to real-world impact.",
      quote: {
        kicker: "Good Ideas Better Tomorrows",
        text: "A more informed world builds a brighter tomorrow.",
        attribution: "STAY CURIOUS. STAY AHEAD.",
      },
      stories: [
        {
          tag: "RESEARCH",
          title: "OpenAI's Agents API Enters Public Beta",
          summary:
            "Build, deploy, and orchestrate AI agents with tools, memory, and long-running workflows.",
          image: "https://picsum.photos/seed/openai-agents/600/380",
        },
        {
          tag: "BUSINESS",
          title: "Mistral AI Secures €3 Billion Series D",
          summary:
            "Fueling Europe's next generation of frontier AI models and multimodal open weights.",
          image: "https://picsum.photos/seed/mistral-tech/600/380",
        },
        {
          tag: "POLICY",
          title: "California Passes Landmark AI Safety Laws",
          summary:
            "SB 813 and AB 1405 establish the first-in-the-nation AI auditor framework.",
          image: "https://picsum.photos/seed/capitol-policy/600/380",
        },
      ],
      ctaText: "Read This Week's Issue →",
      footerTag: "INFORM / INSPIRE / EMPOWER",
    },
  },
  {
    id: "markets",
    name: "Markets Close",
    tagline: "The day in numbers",
    cadence: "Weekdays at 6pm",
    blurb:
      "Indices, commodities and the moves that mattered — in the time it takes to finish your chai.",
    topics: ["Indices", "Commodities", "Currencies"],
    sample: {
      volNumber: "SERIES 2 · ED. 194",
      date: "WEEKDAYS AT 6:00 PM IST",
      topBannerLeft: "THE CLOSING BELL",
      topBannerRight: "NUMBERS THAT MOVED TODAY",
      subHeader: "INDICES, COMMODITIES AND THE DAY IN NUMBERS",
      headline: "Asian Equities Rally as Regional Inflation Cools.",
      leadDek:
        "Benchmark indices closed at two-month highs led by manufacturing gains and easing crude import bills across developing markets.",
      quote: {
        kicker: "Market Pulse",
        text: "Price is what you pay; value is what you preserve.",
        attribution: "THE CLOSING VIEW.",
      },
      stories: [
        {
          tag: "INDICES",
          title: "Nifty & Sensex Reclaim Fresh Resistance Band",
          summary:
            "Broad-based buying in capital goods and banks drove third consecutive session gains.",
          image: "https://picsum.photos/seed/stock-market-chart/600/380",
        },
        {
          tag: "COMMODITIES",
          title: "Brent Crude Eases Toward $74 on Surplus Data",
          summary:
            "Non-OPEC output increases cushion maritime freight risks across Red Sea transit routes.",
          image: "https://picsum.photos/seed/crude-oil-tanker/600/380",
        },
        {
          tag: "BONDS",
          title: "Ten-Year Sovereign Yields Compress 8 Bps",
          summary:
            "Institutional inflows accelerate after unexpected moderation in quarterly wholesale prices.",
          image: "https://picsum.photos/seed/financial-district/600/380",
        },
      ],
      ctaText: "View Full Market Sheet →",
      footerTag: "ANALYSIS / DISCIPLINE / PERSPECTIVE",
    },
  },
  {
    id: "world",
    name: "The World Weekly",
    tagline: "Forty countries, one email",
    cadence: "Every Sunday",
    blurb:
      "The week's essential reporting from our correspondents — the stories behind the headlines.",
    topics: ["World", "Politics", "Economy"],
    sample: {
      volNumber: "VOL. 3 · ISSUE 41",
      date: "SUNDAY DISPATCH",
      topBannerLeft: "THE WORLD WEEKLY",
      topBannerRight: "FORTY COUNTRIES, ONE DESK",
      subHeader: "ESSENTIAL REPORTING FROM OUR CORRESPONDENTS WORLDWIDE",
      headline: "Maritime Corridors Reshape Atlantic Trade Routes.",
      leadDek:
        "Deepwater upgrades and automated container terminals from West Africa to Iberia rebalance container flows away from historic bottlenecks.",
      quote: {
        kicker: "Correspondent's Note",
        text: "The story of the world is written at its borders and harbours.",
        attribution: "GLOBAL DISPATCH.",
      },
      stories: [
        {
          tag: "LOGISTICS",
          title: "West African Ports Cut Vessel Turnaround Times",
          summary:
            "New crane automation and round-the-clock clearance clear lingering harbor queues.",
          image: "https://picsum.photos/seed/container-port/600/380",
        },
        {
          tag: "TRADE",
          title: "Cross-Border Rail Accord Connects Central Asia",
          summary:
            "Three nations launch unified cargo customs reducing transit between Caspian and ports.",
          image: "https://picsum.photos/seed/cargo-freight-train/600/380",
        },
        {
          tag: "POLICY",
          title: "Renewable Hydrogen Pipeline Approved in North Sea",
          summary:
            "Cross-border consortia ink funding agreement for industrial heating conversions.",
          image: "https://picsum.photos/seed/offshore-wind/600/380",
        },
      ],
      ctaText: "Read The World Dispatch →",
      footerTag: "PERSPECTIVE / DEPTH / BALANCE",
    },
  },
  {
    id: "weekend",
    name: "Weekend Longform",
    tagline: "Stories that take their time",
    cadence: "Every Saturday",
    blurb:
      "Our best long reads of the week, plus one classic from the archive worth revisiting.",
    topics: ["Longform", "Culture", "In Pictures"],
    sample: {
      volNumber: "SATURDAY EDITION",
      date: "SATURDAY, NOV 21, 2026",
      topBannerLeft: "WEEKEND LONGFORM",
      topBannerRight: "STORIES THAT TAKE THEIR TIME",
      subHeader: "INVESTIGATIVE JOURNALISM, ESSAYS AND ARCHIVAL ESSENTIALS",
      headline: "The Secret Life of Ancient Subterranean Canals.",
      leadDek:
        "How five-hundred-year-old gravity-fed water channels under the Deccan plateau continue to irrigate fields through modern droughts.",
      quote: {
        kicker: "The Weekend Reader",
        text: "Some stories cannot be hurried into three hundred words.",
        attribution: "TAKE YOUR TIME.",
      },
      stories: [
        {
          tag: "INVESTIGATION",
          title: "The Vanishing Forest Corridors of the Western Ghats",
          summary:
            "Six months on foot with field biologists tracking canopy fragmentation across three states.",
          image: "https://picsum.photos/seed/rainforest-mist/600/380",
        },
        {
          tag: "MEMOIR",
          title: "Letters from a Bombay Typesetter, 1968",
          summary:
            "A linotype operator remembers the midnight rush of printing lead galleys for morning papers.",
          image: "https://picsum.photos/seed/vintage-press-type/600/380",
        },
        {
          tag: "PHOTO ESSAY",
          title: "High-Altitude Salt Harvesters of Ladakh",
          summary:
            "Intimate portraits of families working seasonal brine lakes before winter passes close.",
          image: "https://picsum.photos/seed/himalayan-salt-lakes/600/380",
        },
      ],
      ctaText: "Read All Longform Stories →",
      footerTag: "PATIENCE / RIGOUR / CRAFT",
    },
  },
  {
    id: "india",
    name: "India This Week",
    tagline: "From every corner",
    cadence: "Every Saturday",
    blurb:
      "Politics, policy and the states — a crisp weekly roundup of the national story.",
    topics: ["India", "Politics", "Education"],
    sample: {
      volNumber: "VOL. 2 · ISSUE 48",
      date: "SATURDAY MORNING",
      topBannerLeft: "INDIA THIS WEEK",
      topBannerRight: "FROM EVERY CORNER",
      subHeader: "NATIONAL REPORTING, STATE POLICIES AND GRASSROOTS DEVELOPMENTS",
      headline: "Regional Expressways Drive New Tier-2 Industrial Clusters.",
      leadDek:
        "Access-controlled freight corridors shift manufacturing hubs toward smaller towns, spurring employment and reversing metropolitan migration.",
      quote: {
        kicker: "National Memo",
        text: "A nation moves forward when its towns thrive alongside its capitals.",
        attribution: "EVERY STATE. EVERY VOICE.",
      },
      stories: [
        {
          tag: "INFRASTRUCTURE",
          title: "High-Speed Rail Phase 2 Civil Works Begin",
          summary:
            "Tunnel boring machines commence 45-km stretch connecting western industrial hubs.",
          image: "https://picsum.photos/seed/highspeed-bullet-train/600/380",
        },
        {
          tag: "EDUCATION",
          title: "State Universities Roll Out Dual-Degree Apprenticeships",
          summary:
            "Over two hundred technical institutions integrate semester-long factory training credits.",
          image: "https://picsum.photos/seed/university-campus/600/380",
        },
        {
          tag: "INNOVATION",
          title: "Millets Innovation Hub Exports Climate-Hardy Seeds",
          summary:
            "Traditional dryland grain varieties gain traction across African and Mediterranean farms.",
          image: "https://picsum.photos/seed/agriculture-field/600/380",
        },
      ],
      ctaText: "Read National Roundup →",
      footerTag: "FEDERAL / VIBRANT / INCLUSIVE",
    },
  },
];

/* --- Desk editions -------------------------------------------------------
   One newsletter per newsroom desk. Desks already covered by a flagship
   edition (world, markets, technology→pulse, longform→weekend, india) are
   skipped so readers never see two newsletters for the same desk. */

type DeskStory = { tag: string; title: string; summary: string };

function deskNewsletter(cfg: {
  id: string;
  name: string;
  tagline: string;
  cadence: string;
  blurb: string;
  topics: string[];
  headline: string;
  leadDek: string;
  stories: DeskStory[];
}): Newsletter {
  return {
    id: cfg.id,
    name: cfg.name,
    tagline: cfg.tagline,
    cadence: cfg.cadence,
    blurb: cfg.blurb,
    topics: cfg.topics,
    sample: {
      volNumber: "VOL. 1 · WEEKLY",
      date: cfg.cadence.toUpperCase(),
      topBannerLeft: cfg.name.toUpperCase(),
      topBannerRight: "REPORTED WITH CARE",
      subHeader: cfg.blurb.toUpperCase(),
      headline: cfg.headline,
      leadDek: cfg.leadDek,
      quote: {
        kicker: `From the ${cfg.name} desk`,
        text: "Every desk has a story worth your inbox — we make sure it reaches you.",
        attribution: cfg.cadence.toUpperCase(),
      },
      stories: cfg.stories.map((story, index) => ({
        ...story,
        image: `https://picsum.photos/seed/nl-${cfg.id}-${index}/600/380`,
      })),
      ctaText: `Read ${cfg.name} →`,
      footerTag: "INFORM / INSPIRE / EMPOWER",
    },
  };
}

const DESK_NEWSLETTERS: Newsletter[] = [
  deskNewsletter({
    id: "politics",
    name: "Politics Weekly",
    tagline: "Power, policy, people",
    cadence: "Every Monday",
    blurb: "Elections, policy and the people behind them — the week in the capital, decoded.",
    topics: ["Elections", "Policy", "Governance"],
    headline: "Coalition Talks Reshape the Capital's Power Map.",
    leadDek:
      "Alliance arithmetic shifts again as regional parties trade ministries for transport and energy portfolios.",
    stories: [
      { tag: "POLICY", title: "Voting Reform Bill Clears Committee Stage", summary: "Bipartisan panel advances ballot-access changes to the floor for a winter vote." },
      { tag: "ANALYSIS", title: "The New Geography of Swing States", summary: "Three fast-growing districts now decide more elections than entire regions once did." },
      { tag: "GOVERNANCE", title: "Federal Grants Rethink Urban Housing Rules", summary: "Cities accepting transit funds must relax density caps near new metro corridors." },
    ],
  }),
  deskNewsletter({
    id: "business",
    name: "Business Weekly",
    tagline: "Companies & capital",
    cadence: "Every Wednesday",
    blurb: "Companies, startups and the deals moving Indian business — midweek, in your inbox.",
    topics: ["Companies", "Startups", "Trade"],
    headline: "Homegrown Chip Startup Lands Its First Export Deal.",
    leadDek:
      "A three-year-old design house signs a supply agreement with a European automaker, beating two global incumbents.",
    stories: [
      { tag: "COMPANIES", title: "Legacy Textile Giant Pivots to Technical Fabrics", summary: "Century-old mills retool for defence and medical supply contracts." },
      { tag: "STARTUPS", title: "Fintech Funding Rebounds After a Quiet Year", summary: "Late-stage cheques return as payment firms post their first profitable quarters." },
      { tag: "TRADE", title: "New Corridors Cut Export Times by a Third", summary: "Dedicated freight routes move apparel and pharma cargo to ports in under a day." },
    ],
  }),
  deskNewsletter({
    id: "science",
    name: "The Science Desk",
    tagline: "Evidence, first",
    cadence: "Every Thursday",
    blurb: "Discoveries, climate and the natural world — peer-reviewed and plain-spoken.",
    topics: ["Research", "Space", "Climate"],
    headline: "Deep-Sea Robots Map Vents Beneath Antarctic Ice.",
    leadDek:
      "Autonomous submersibles return the first complete chemistry of hidden hydrothermal fields under the shelf.",
    stories: [
      { tag: "RESEARCH", title: "Fusion Test Reactor Holds Plasma for 94 Seconds", summary: "A national tokamak doubles its previous confinement record in overnight trials." },
      { tag: "SPACE", title: "Lunar South Pole Ice Confirmed by Twin Probes", summary: "Orbital radar and a surface drill agree on accessible water deposits in shadowed craters." },
      { tag: "MEDICINE", title: "CRISPR Therapy Clears First Phase-3 Trial", summary: "A single-infusion treatment for a rare blood disorder moves toward approval." },
    ],
  }),
  deskNewsletter({
    id: "sports",
    name: "The Sports Desk",
    tagline: "Final scores & first calls",
    cadence: "Every Monday",
    blurb: "Scores, transfers and the stories behind the games — before the Monday debates begin.",
    topics: ["Cricket", "Football", "Athletics"],
    headline: "Under-19s Lift the Cup After a Last-Over Thriller.",
    leadDek:
      "A nerveless final over seals a junior title that had slipped away twice in the tournament's earlier rounds.",
    stories: [
      { tag: "CRICKET", title: "Domestic League Expands to Twelve Franchises", summary: "Two new city teams join next season as broadcast rights hit a record." },
      { tag: "FOOTBALL", title: "National Women's Side Qualifies for Continental Cup", summary: "An unbeaten qualifying run books a first-ever spot in the regional finals." },
      { tag: "ATHLETICS", title: "Junior Sprinter Breaks National 200m Record", summary: "A 19-year-old clocks the fastest wind-legal time in the country's history." },
    ],
  }),
  deskNewsletter({
    id: "entertainment",
    name: "Entertainment Weekly",
    tagline: "Screens, streams & stages",
    cadence: "Every Friday",
    blurb: "Cinema, streaming, music and celebrity news — your weekend watchlist, sorted.",
    topics: ["Cinema", "Streaming", "Music"],
    headline: "Indie Drama Sweeps the Festival's Top Honours.",
    leadDek:
      "A debut feature shot in twenty-one days takes best film, director and screenplay on closing night.",
    stories: [
      { tag: "CINEMA", title: "Studio Slate Adds Three Regional-Language Epics", summary: "Big-budget period films greenlit across four industries for next year." },
      { tag: "STREAMING", title: "Docuseries Boom Draws Record Audiences", summary: "True-story formats now account for a third of all weekend viewing hours." },
      { tag: "MUSIC", title: "Classical Fusion Tour Sells Out Twelve Cities", summary: "Orchestral collaborations with folk artists find a new young audience." },
    ],
  }),
  deskNewsletter({
    id: "culture",
    name: "Culture Weekly",
    tagline: "Books, art & ideas",
    cadence: "Every Sunday",
    blurb: "Books, film, music and the arts — the week's ideas worth slow Sunday reading.",
    topics: ["Books", "Art", "Theatre"],
    headline: "A Lost Manuscript Rewrites a Classical Epic.",
    leadDek:
      "Archivists authenticate an eighteenth-century draft that changes how scholars read the poem's final act.",
    stories: [
      { tag: "BOOKS", title: "Translated Poetry Tops the Year's Prize Lists", summary: "Collections in four languages share the major literary honours this season." },
      { tag: "ART", title: "Biennale Turns a Dockyard into a Gallery", summary: "Forty artists take over disused shipyards for the largest edition yet." },
      { tag: "THEATRE", title: "Street Theatre Festival Draws a Million Visitors", summary: "Open-air productions return to the old quarter for ten straight nights." },
    ],
  }),
  deskNewsletter({
    id: "lifestyle",
    name: "Lifestyle Weekly",
    tagline: "The art of everyday",
    cadence: "Every Saturday",
    blurb: "Fashion, food, design and how we live — small upgrades for the week ahead.",
    topics: ["Food", "Design", "Living"],
    headline: "Slow Living Finds Its Way Into City Homes.",
    leadDek:
      "Courtyard kitchens, reading corners and balcony gardens top renovation wishlists across the metros.",
    stories: [
      { tag: "FOOD", title: "Regional Breakfasts Get a Modern Reinvention", summary: "Heritage dishes return to cafe menus with nutritionist-approved twists." },
      { tag: "DESIGN", title: "Compact Homes Inspire a New Furniture Wave", summary: "Modular, foldable pieces outsell conventional sets for the first time." },
      { tag: "WELLNESS", title: "Weekend Farmers' Markets Double in a Year", summary: "Neighbourhood markets now anchor Saturday routines in forty cities." },
    ],
  }),
  deskNewsletter({
    id: "health",
    name: "The Health Desk",
    tagline: "Body & mind, examined",
    cadence: "Every Wednesday",
    blurb: "Medicine, wellness and the science of the body — evidence you can act on.",
    topics: ["Medicine", "Wellness", "Nutrition"],
    headline: "Routine Scans Catch More Cancers Earlier.",
    leadDek:
      "Expanded screening programmes shift detection a full stage earlier across six common cancers.",
    stories: [
      { tag: "MEDICINE", title: "AI-Assisted Radiology Clears Hospital Trials", summary: "Flagged scans reach specialists forty percent faster in pilot districts." },
      { tag: "WELLNESS", title: "Sleep Clinics Report a Surge in Young Patients", summary: "Under-30s now make up a third of new referrals, doctors say." },
      { tag: "NUTRITION", title: "Protein-Fortified Millets Enter School Meals", summary: "Climate-hardy grains join midday menus in eight more states." },
    ],
  }),
  deskNewsletter({
    id: "education",
    name: "Education Weekly",
    tagline: "Classrooms to campuses",
    cadence: "Every Tuesday",
    blurb: "Schools, universities and the business of learning — from exams to employability.",
    topics: ["Schools", "Universities", "Skills"],
    headline: "Community Colleges Pioneer Four-Day Schedules.",
    leadDek:
      "Compressed timetables lift attendance for working students in early pilots across three districts.",
    stories: [
      { tag: "SCHOOLS", title: "District Libraries Reopen on Sundays", summary: "Weekend hours return to two hundred reading rooms after a decade." },
      { tag: "UNIVERSITIES", title: "Dual-Degree Apprenticeships Gain Traction", summary: "Factory semesters now count toward graduation at two hundred institutions." },
      { tag: "SKILLS", title: "Micro-Credential Programmes See Record Sign-Ups", summary: "Short certification courses draw mid-career learners in data and logistics." },
    ],
  }),
  deskNewsletter({
    id: "environment",
    name: "Planet Weekly",
    tagline: "The living planet",
    cadence: "Every Sunday",
    blurb: "Climate, conservation and the living planet — the stakes, minus the doom.",
    topics: ["Climate", "Conservation", "Energy"],
    headline: "Mangrove Belts Expand Along the Eastern Coast.",
    leadDek:
      "Village-led replanting has added a hundred kilometres of storm-buffering forest in five years.",
    stories: [
      { tag: "CLIMATE", title: "Coral Nurseries Record First Natural Spawning", summary: "Restored reefs reach a milestone marine biologists feared was decades away." },
      { tag: "CONSERVATION", title: "Community Forests Gain Legal Protection", summary: "A new framework recognises village stewardship over shared woodland." },
      { tag: "ENERGY", title: "Desert Solar Park Hits Full Capacity Early", summary: "The country's largest array comes online six months ahead of schedule." },
    ],
  }),
  deskNewsletter({
    id: "travel",
    name: "The Travel Desk",
    tagline: "Routes worth taking",
    cadence: "Every Saturday",
    blurb: "Destinations, routes and the art of going places — trips planned by Saturday tea.",
    topics: ["Destinations", "Rail", "Food Trails"],
    headline: "Sleeper Trains Return to the Highlands.",
    leadDek:
      "Overnight services restored on the mountain corridor bring slow rail back into fashion.",
    stories: [
      { tag: "DESTINATIONS", title: "Hidden Valleys Open to Small-Group Treks", summary: "New permit rules cap visitors while opening trails long off-limits." },
      { tag: "RAIL", title: "Scenic Line Adds Panorama Coaches", summary: "Glass-roofed carriages join the coastal route from next month." },
      { tag: "FOOD", title: "A Coastal Trail of a Hundred Eateries", summary: "A mapped weekend route links harbour shacks to heritage kitchens." },
    ],
  }),
  deskNewsletter({
    id: "automobile",
    name: "The Auto Desk",
    tagline: "Wheels in motion",
    cadence: "Every Friday",
    blurb: "Cars, bikes, EVs and the roads they run on — launches, tests and trends.",
    topics: ["EVs", "Two-Wheelers", "Industry"],
    headline: "Solid-State Batteries Reach the Showroom.",
    leadDek:
      "The first mass-market model with solid-state cells promises a ten-minute charge and double the range.",
    stories: [
      { tag: "EV", title: "Compact EV Crosses the 500 km Range Mark", summary: "Real-world testing puts the new hatchback ahead of every rival in class." },
      { tag: "INDUSTRY", title: "Component Hubs Expand Beyond the Metros", summary: "Tier-2 clusters win the next wave of drivetrain and battery assembly." },
      { tag: "MOTORSPORT", title: "Hill-Climb Championship Returns After a Decade", summary: "The revived series will run five rounds on classic mountain stages." },
    ],
  }),
  deskNewsletter({
    id: "gaming",
    name: "The Gaming Desk",
    tagline: "Press start",
    cadence: "Every Friday",
    blurb: "Consoles, PC, esports and the studios making them — your weekend queue, loaded.",
    topics: ["PC", "Consoles", "Esports"],
    headline: "Indian Indie Title Tops Global Charts.",
    leadDek:
      "A mythology-inspired action game built by a nine-person studio outsells the month's biggest releases.",
    stories: [
      { tag: "PC", title: "City Studios Win Big at International Showcase", summary: "Three homegrown teams take awards at the year's largest indie festival." },
      { tag: "CONSOLE", title: "Next-Gen Handhelds Push Cloud Play Forward", summary: "Hybrid devices blur the line between portable and docked gaming." },
      { tag: "ESPORTS", title: "University League Draws Record Viewership", summary: "The inter-campus final peaks past previous professional tournament numbers." },
    ],
  }),
  deskNewsletter({
    id: "opinion",
    name: "The Opinion Desk",
    tagline: "Arguments & ideas",
    cadence: "Every Sunday",
    blurb: "Arguments and ideas from our columnists — the week's sharpest takes, in one place.",
    topics: ["Columns", "Editorials", "Debate"],
    headline: "What Our Columnists Got Right — and Wrong.",
    leadDek:
      "A year of predictions, revisited: the calls that aged well and the ones that did not.",
    stories: [
      { tag: "COLUMN", title: "The Case for Slower Cities", summary: "Why the next urban dividend comes from streets built for lingering." },
      { tag: "EDITORIAL", title: "Data Privacy Needs a Federal Frame", summary: "Patchwork state rules leave citizens — and companies — guessing." },
      { tag: "DEBATE", title: "Two Economists Argue the Growth Number", summary: "What the headline figure hides, depending on which model you trust." },
    ],
  }),
  deskNewsletter({
    id: "in-pictures",
    name: "The Week in Pictures",
    tagline: "The week, seen",
    cadence: "Every Sunday",
    blurb: "The week through our photographers' lenses — ten frames that tell the story.",
    topics: ["Photo Essays", "Galleries", "Field Notes"],
    headline: "Monsoon Light Over the Old Harbour.",
    leadDek:
      "Our photographer of the week spent five mornings waiting for one frame on the breakwater.",
    stories: [
      { tag: "GALLERY", title: "Festival of Lights Across Twelve States", summary: "One celebration, a dozen traditions — seen from street level." },
      { tag: "FIELD NOTES", title: "Shepherds on the High Himalayan Passes", summary: "A seasonal migration photographed over three winters." },
      { tag: "ARCHIVE", title: "The City in 1975: Newly Scanned Frames", summary: "Rediscovered negatives show a skyline before the towers." },
    ],
  }),
  deskNewsletter({
    id: "economy",
    name: "Economy Weekly",
    tagline: "Growth, decoded",
    cadence: "Every Monday",
    blurb: "Growth, jobs, prices and the policy behind them — the numbers that matter.",
    topics: ["Growth", "Jobs", "Prices"],
    headline: "Tier-3 Towns Lead the Hiring Rebound.",
    leadDek:
      "Smaller cities now post the fastest job growth as firms follow talent away from the metros.",
    stories: [
      { tag: "GROWTH", title: "Manufacturing Output Beats Forecasts Again", summary: "Factory activity expands for a seventh straight month on export orders." },
      { tag: "JOBS", title: "Rural Wages Rise for a Sixth Straight Month", summary: "Non-farm work now drives most of the income gains in the countryside." },
      { tag: "PRICES", title: "Retail Inflation Eases to a Two-Year Low", summary: "Cooling food costs pull the headline rate inside the comfort band." },
    ],
  }),
];

export const NEWSLETTERS: Newsletter[] = [...FLAGSHIP_NEWSLETTERS, ...DESK_NEWSLETTERS];
export { FLAGSHIP_NEWSLETTERS, DESK_NEWSLETTERS };
