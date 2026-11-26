// Lightweight writing checks for the compose form — no dictionary download,
// just the mistakes copy desks actually make: doubled words, stray spaces,
// lowercase starts, run-on sentences and a short list of common misspellings.
export type ProofKey = "title" | "dek" | "lead" | "body";

export type ProofIssue = {
  key: ProofKey;
  field: string;
  message: string;
  find: string;
  // Suggested replacement. Absent for issues that need judgement (long
  // sentences) — those show as advice only.
  fix?: string;
};

const FIELD_LABEL: Record<ProofKey, string> = {
  title: "Headline",
  dek: "Standfirst",
  lead: "Lead",
  body: "Story",
};

const MISSPELLINGS: Record<string, string> = {
  accomodate: "accommodate",
  adress: "address",
  apparant: "apparent",
  arguement: "argument",
  beleive: "believe",
  comming: "coming",
  commitee: "committee",
  concious: "conscious",
  definately: "definitely",
  dissapear: "disappear",
  embarass: "embarrass",
  enviroment: "environment",
  exsist: "exist",
  goverment: "government",
  grammer: "grammar",
  immediatly: "immediately",
  independant: "independent",
  liason: "liaison",
  maintainance: "maintenance",
  managment: "management",
  miniscule: "minuscule",
  mispell: "misspell",
  neccessary: "necessary",
  noticable: "noticeable",
  occassion: "occasion",
  occurance: "occurrence",
  occured: "occurred",
  persue: "pursue",
  posession: "possession",
  priviledge: "privilege",
  pronounciation: "pronunciation",
  publically: "publicly",
  recomend: "recommend",
  recieve: "receive",
  refering: "referring",
  rember: "remember",
  rythm: "rhythm",
  seperate: "separate",
  sieze: "seize",
  sucessful: "successful",
  supercede: "supersede",
  teh: "the",
  thier: "their",
  tommorow: "tomorrow",
  truely: "truly",
  untill: "until",
  vaccum: "vacuum",
  wich: "which",
  wierd: "weird",
  withing: "within",
  writting: "writing",
};

const MAX_ISSUES = 60;
const MAX_SENTENCE_WORDS = 45;

// Keep the casing of the match when suggesting a fix ("Teh" → "The").
const matchCase = (found: string, fix: string) =>
  /^[A-Z]/.test(found) ? fix[0].toUpperCase() + fix.slice(1) : fix;

function scanText(key: ProofKey, text: string, plainOnly: boolean, issues: ProofIssue[]): void {
  const push = (message: string, find: string, fix?: string) => {
    if (issues.length < MAX_ISSUES && find.trim()) {
      issues.push({ key, field: FIELD_LABEL[key], message, find, fix });
    }
  };

  for (const m of text.matchAll(/\b[A-Za-z][A-Za-z']*\b/g)) {
    const fix = MISSPELLINGS[m[0].toLowerCase()];
    if (fix) push("Possible misspelling", m[0], matchCase(m[0], fix));
  }

  for (const m of text.matchAll(/\b([A-Za-z][A-Za-z']*)[ \t]+\1\b/gi)) {
    push("Repeated word", m[0], m[1]);
  }

  if (plainOnly) {
    for (const m of text.matchAll(/\S[ \t]{2,}\S/g)) {
      push("Double space", m[0], `${m[0][0]} ${m[0][m[0].length - 1]}`);
    }
    if (/^[a-z]/.test(text.trimStart())) {
      const trimmed = text.trimStart();
      push("Start with a capital letter", trimmed.slice(0, 12), trimmed[0].toUpperCase() + trimmed.slice(1, 12));
    }
  }

  for (const m of text.matchAll(/[^.!?\n]+[.!?]?(?=\s|$)/g)) {
    const sentence = m[0].trim();
    const words = sentence.split(/\s+/).filter(Boolean).length;
    if (words > MAX_SENTENCE_WORDS) {
      push(
        `Long sentence (${words} words) — consider splitting it`,
        sentence.slice(0, 40) + "…",
      );
    }
  }
}

export function proofread(parts: Record<ProofKey, string>): ProofIssue[] {
  const issues: ProofIssue[] = [];
  for (const key of Object.keys(FIELD_LABEL) as ProofKey[]) {
    const text = parts[key] ?? "";
    if (!text.trim()) continue;
    // The body arrives as joined HTML text, so spacing checks don't apply —
    // only word-level checks that survive the strip.
    scanText(key, text, key !== "body", issues);
  }
  return issues;
}
