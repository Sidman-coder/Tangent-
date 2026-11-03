// Grill me, the rules: which questions a plan earns, in what order, and how many
// a student sees. Pure and AI-free, so the budget can be tested and trusted.
// lib/store.ts keeps the rows; components/grill/GrillDeck.tsx asks them.

export const GRILL_KINDS = ["deadline", "hours", "level", "hardest", "constraints"] as const;
export type GrillKind = (typeof GRILL_KINDS)[number];

export type GrillStatus = "open" | "answered" | "skipped" | "expired";

export type GrillItem = {
  id: string;
  projectId: string | null;
  question: string;
  /** A GrillKind, or "general" for one with no plan behind it. */
  kind: string;
  choices: string[];
  priority: number;
  status: GrillStatus;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
};

export type GrillDraft = Pick<GrillItem, "question" | "kind" | "choices" | "priority">;

/** Questions for one project or task, before and after its preview together. */
export const PLAN_BUDGET = 3;
/** Today's card asks at most this many a day. */
export const TODAY_BUDGET = 3;
/** "Grill me now" stops here, and checks in at IN_A_ROW. */
export const SESSION_BUDGET = 5;
/** Never more than this without the student saying keep going. */
export const IN_A_ROW = 3;
/** An unanswered question goes stale: the plan has moved on. */
const STALE_DAYS = 30;

/** Ranked by how much the answer changes the plan. */
const TEMPLATES: Record<GrillKind, { priority: number; choices: string[]; ask: (title: string) => string; short: string }> = {
  deadline: {
    priority: 50,
    choices: ["In 2 weeks", "In a month", "End of term", "No real deadline"],
    ask: (t) => `When does ${t} need to be done?`,
    short: "needs to be done",
  },
  hours: {
    priority: 40,
    choices: ["1–2 hrs", "3–5 hrs", "6–10 hrs", "10+ hrs"],
    ask: (t) => `How many hours a week can you give ${t}?`,
    short: "hours a week",
  },
  level: {
    priority: 30,
    choices: ["Starting fresh", "Know the basics", "Pretty solid", "Just polishing"],
    ask: (t) => `Where are you starting from on ${t}?`,
    short: "starting from",
  },
  hardest: {
    priority: 20,
    choices: ["Getting started", "Staying consistent", "Finding time", "Understanding it"],
    ask: (t) => `What's the hardest part of ${t}?`,
    short: "hardest part",
  },
  constraints: {
    priority: 10,
    choices: ["Weekends are out", "Evenings are out", "Sports or practice", "Nothing fixed"],
    ask: (t) => `Anything fixed Tangent should plan ${t} around?`,
    short: "plan around",
  },
};

/** Which question a clarify question (lib/ai/clarify.ts) was really asking. */
export function kindOfQuestion(question: string): GrillKind | null {
  const q = question.toLowerCase();
  if (/\b(when|deadline|due|by what date|how long|timeframe|how soon)\b/.test(q)) return "deadline";
  if (/\b(hours?|how much time|how often|times a week|per week|a week)\b/.test(q)) return "hours";
  if (/\b(level|already|so far|experience|starting|know|familiar|done)\b/.test(q)) return "level";
  if (/\b(hardest|struggl|stuck|toughest|weak)/.test(q)) return "hardest";
  if (/\b(around|fixed|constraint|can't|cannot|busy|unavailable)\b/.test(q)) return "constraints";
  return null;
}

const SAYS: Record<GrillKind, RegExp> = {
  deadline: /\b(deadline|due|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|by (next|the end|end of)|on (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|in (a|an|\d+|two|three|four|six) (day|week|month|year)s?|\d{4}-\d{2}-\d{2}|needs? to be done|end of (term|semester|year)|no real deadline)\b/i,
  hours: /\b(\d+(\.\d+)?(\s*[–-]\s*\d+)?\+?\s*(hours?|hrs?|h)\s*(a|per|each|every)\s*week|hours a week)\b/i,
  level: /\b(already|beginner|intermediate|advanced|starting (fresh|from)|from scratch|never (done|tried)|know the basics|pretty solid|polishing|so far)\b/i,
  hardest: /\b(hardest|struggl\w*|stuck|trouble with|toughest|weakest)\b/i,
  constraints: /\b(plan around|can't do|cannot do|not available|unavailable|nothing fixed|(weekends?|evenings?|mornings?) (are|is) out)\b/i,
};

// Too common in project names to say a fact is about this project.
const GENERIC = new Set(["prep", "prepare", "study", "studying", "final", "finals", "exam", "test", "project", "plan", "learn", "start", "write", "work", "with", "from", "class", "school", "that", "this", "ready", "get", "for", "the", "and", "my"]);

function namesProject(fact: string, title: string): boolean {
  const words = title.toLowerCase().split(/[\s,.;:!?()/'"-]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  const said = fact.toLowerCase();
  return words.some((w) => said.includes(w));
}

/** What Tangent can already answer: from the student's words, or from a fact
 *  about this project. Fixed constraints are the student's, not the project's. */
export function knownKinds(facts: string[], title: string, said = ""): Set<GrillKind> {
  const known = new Set<GrillKind>();
  for (const kind of GRILL_KINDS) {
    if (SAYS[kind].test(said)) known.add(kind);
    else if (facts.some((f) => SAYS[kind].test(f) && (kind === "constraints" || namesProject(f, title)))) known.add(kind);
  }
  return known;
}

/** The questions this plan earns: highest impact first, never one Tangent knows
 *  or has asked before, within what's left of the plan's budget. */
export function pickGrillQuestions(opts: {
  title: string;
  facts: string[];
  said?: string;
  /** Kinds this project was already asked, whatever the answer was. */
  asked?: string[];
  /** Asked before the preview; they count against the budget. */
  askedJustNow?: number;
}): GrillDraft[] {
  const known = knownKinds(opts.facts, opts.title, opts.said);
  const asked = new Set(opts.asked ?? []);
  const budget = Math.max(0, PLAN_BUDGET - (opts.askedJustNow ?? 0));
  return GRILL_KINDS.filter((k) => !known.has(k) && !asked.has(k))
    .sort((a, b) => TEMPLATES[b].priority - TEMPLATES[a].priority)
    .slice(0, budget)
    .map((k) => ({ question: TEMPLATES[k].ask(opts.title), kind: k, choices: TEMPLATES[k].choices, priority: TEMPLATES[k].priority }));
}

/** Open questions, most important first; oldest first within that. */
export function rankQueue(items: GrillItem[]): GrillItem[] {
  return items
    .filter((i) => i.status === "open")
    .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
}

/** Today's card: the top of the queue, less whatever was already dealt with today. */
export function todayQueue(items: GrillItem[], today: string, dayOf: (iso: string) => string): GrillItem[] {
  const handled = items.filter((i) => (i.status === "answered" || i.status === "skipped") && i.answeredAt && dayOf(i.answeredAt) === today).length;
  return rankQueue(items).slice(0, Math.max(0, TODAY_BUDGET - handled));
}

/** Does an answer of this kind change how the plan should be laid out? */
export function changesPlan(kind: string): boolean {
  return kind === "deadline" || kind === "hours" || kind === "constraints";
}

/** The line saved to What Tangent knows, naming the project it's about. */
export function factFromAnswer(item: Pick<GrillItem, "question" | "kind">, answer: string, projectTitle: string | null): string {
  const template = TEMPLATES[item.kind as GrillKind];
  const line = projectTitle && template ? `${projectTitle}, ${template.short}: ${answer}` : `${item.question.replace(/\?\s*$/, "")}: ${answer}`;
  return line.slice(0, 300);
}

export function factCategory(kind: string): "commitment" | "habit" | "work" | "general" {
  if (kind === "deadline" || kind === "constraints") return "commitment";
  if (kind === "hours") return "habit";
  if (kind === "level" || kind === "hardest") return "work";
  return "general";
}

export function isStale(item: Pick<GrillItem, "status" | "createdAt">, now: Date): boolean {
  return item.status === "open" && now.getTime() - new Date(item.createdAt).getTime() > STALE_DAYS * 86_400_000;
}

/** What the re-plan chat is told, in the student's voice. */
export function replanRequest(question: string, answer: string): string {
  return `Re-plan this project around my answer. ${question} ${answer}`;
}
