// The daily follow-up after onboarding (Round 4 Phase 6): one deeper question
// at a time, picked from what Tangent knows least well. Pure and client-safe,
// so the choice and the daily rule can be tested.
//
// Order: dig into what the student said about slipping and what matters this
// year, then check things Tangent only guessed, then fill whole areas it knows
// nothing about. The student types the answer (no quick replies); it's saved
// as a fact they said, under the question's own slot key, so it's never asked
// again.

import { factCategoryFor, isFactCategory, isVagueValue, type FactCategory } from "./facts";
import { looksDistressed } from "./sensitive";

export type FollowUp = {
  /** Stable id, remembered once answered or dismissed. */
  id: string;
  ask: string;
  why: string;
  placeholder: string;
  factCategory: FactCategory;
  /** Saved with the answer; a fact with this key means it's been answered. */
  slotKey: string;
  /** Put before the answer to make the fact: "What piles up first for you: ". */
  lead: string;
  /** Set when checking a guess: the fact being checked. */
  checkId?: string;
};

/** The parts of a stored fact the choice reads (ContextEntry fits). */
export type KnownFact = {
  id: string;
  fact: string;
  category?: string;
  factCategory?: FactCategory;
  slotKey?: string | null;
  unconfirmed?: boolean;
};

type Candidate = Omit<FollowUp, "id" | "factCategory"> & { factCategory: FactCategory };

const WHY = "So plans fit how things really go for you.";

// "You said…" follow-ups for each slip picked in onboarding (lib/onboarding-facts.ts).
const SLIP_FOLLOW_UPS: { match: RegExp; q: Candidate }[] = [
  {
    match: /\bfreeze\b/i,
    q: {
      slotKey: "fuSlipFreeze",
      ask: "You said things pile up and you freeze. What usually piles up first, school or everything else?",
      why: "So Tangent can thin that out before it stacks up.",
      placeholder: "e.g. homework, then club stuff on top",
      factCategory: "whats_hard",
      lead: "What piles up first for you: ",
    },
  },
  {
    match: /\bput things off\b/i,
    q: {
      slotKey: "fuSlipPutOff",
      ask: "You said you put things off. What kind of thing do you put off most?",
      why: "So Tangent can start those early, in small pieces.",
      placeholder: "e.g. essays, anything with reading",
      factCategory: "whats_hard",
      lead: "What you put off most: ",
    },
  },
  {
    match: /\bforget\b/i,
    q: {
      slotKey: "fuSlipForget",
      ask: "You said things slip your mind. What do you forget most: assignments, dates, or stuff people tell you?",
      why: "So Tangent catches the right things for you.",
      placeholder: "e.g. small homework that isn't on Canvas",
      factCategory: "whats_hard",
      lead: "What you forget most: ",
    },
  },
  {
    match: /\bfade\b/i,
    q: {
      slotKey: "fuSlipFade",
      ask: "You said you start strong, then fade. When does it usually fade, and what makes it?",
      why: "So Tangent can check in right before that point.",
      placeholder: "e.g. after about a week, when it gets boring",
      factCategory: "whats_hard",
      lead: "When you fade: ",
    },
  },
  {
    match: /\bwhere to start\b/i,
    q: {
      slotKey: "fuSlipStart",
      ask: "When you don't know where to start, what usually gets you going in the end?",
      why: "So Tangent can hand you that first step.",
      placeholder: "e.g. a friend explaining it, a tiny first task",
      factCategory: "how_you_work",
      lead: "What gets you started: ",
    },
  },
  {
    match: /\bperfect\b/i,
    q: {
      slotKey: "fuSlipPerfect",
      ask: "You said you get stuck making things perfect. What kind of work does that happen with most?",
      why: "So Tangent can help you call it done.",
      placeholder: "e.g. essays and slides",
      factCategory: "whats_hard",
      lead: "Where you get stuck on perfect: ",
    },
  },
];

// Deeper questions about what matters this year.
const MATTER_FOLLOW_UPS: { match: RegExp; q: Candidate }[] = [
  {
    match: /\bAP exams\b/,
    q: {
      slotKey: "fuApExams",
      ask: "Which AP exams are you taking this year?",
      why: "So Tangent can start review early enough.",
      placeholder: "e.g. AP Bio and AP Lang",
      factCategory: "classes_activities",
      lead: "Your AP exams this year: ",
    },
  },
  {
    match: /\bcollege apps\b/i,
    q: {
      slotKey: "fuCollegeApps",
      ask: "Where are you thinking of applying, and when's the first deadline?",
      why: "So nothing about applications sneaks up.",
      placeholder: "e.g. state schools, early action Nov 1",
      factCategory: "future",
      lead: "College applications: ",
    },
  },
  {
    match: /\ba sport\b/i,
    q: {
      slotKey: "fuSport",
      ask: "Which sport do you play, and when is your season?",
      why: "Season weeks are busier, so plans can lighten up.",
      placeholder: "e.g. soccer, August to November",
      factCategory: "classes_activities",
      lead: "Your sport: ",
    },
  },
  {
    match: /\ba personal project\b/i,
    q: {
      slotKey: "fuProject",
      ask: "What's the personal project, and what would done look like?",
      why: "So it gets real time, not leftover time.",
      placeholder: "e.g. a game in Unity, playable demo by spring",
      factCategory: "goals",
      lead: "Your personal project: ",
    },
  },
];

// When Tangent knows nothing in an area. In the order they're asked.
const AREA_FOLLOW_UPS: Candidate[] = [
  {
    slotKey: "fuSchoolNight",
    ask: "What does a normal school night look like for you, from getting home to bed?",
    why: "So plans fit the time you really have.",
    placeholder: "e.g. home at 4, practice till 6, homework after dinner",
    factCategory: "schedule",
    lead: "A normal school night: ",
  },
  {
    slotKey: "fuThisYear",
    ask: "What's one thing you'd love to have done by the end of this year?",
    why: "So plans aim at something real.",
    placeholder: "e.g. bring my chem grade up to an A",
    factCategory: "goals",
    lead: "By the end of this year, you'd love to: ",
  },
  {
    slotKey: "fuHardest",
    ask: "What's the hardest part of keeping up right now?",
    why: "Tangent will watch for exactly that.",
    placeholder: "e.g. too many small assignments at once",
    factCategory: "whats_hard",
    lead: "The hardest part of keeping up: ",
  },
  {
    slotKey: "fuWorkBest",
    ask: "When do you get your best work done, and what helps you focus?",
    why: "Hard things go where you're sharpest.",
    placeholder: "e.g. after a snack, music on, phone in another room",
    factCategory: "how_you_work",
    lead: "How you work best: ",
  },
  {
    slotKey: "fuDrains",
    ask: "Which class or activity takes the most out of you right now?",
    why: "So Tangent gives it more room.",
    placeholder: "e.g. AP Chem, the labs take forever",
    factCategory: "classes_activities",
    lead: "What takes the most out of you right now: ",
  },
  {
    slotKey: "fuAfterHs",
    ask: "Anything you're curious about doing after high school? Not sure is fine.",
    why: "So Tangent can point some of your time that way.",
    placeholder: "e.g. something with animals, maybe vet school",
    factCategory: "future",
    lead: "After high school, you're curious about: ",
  },
  {
    slotKey: "fuPush",
    ask: "When you start falling behind, how should Tangent tell you?",
    why: "So reminders feel like help, not nagging.",
    placeholder: "e.g. just tell me straight, once",
    factCategory: "push_style",
    lead: "When you fall behind, you want Tangent to: ",
  },
];

const withId = (q: Candidate): FollowUp => ({ ...q, id: q.slotKey });

function lowerFirst(s: string): string {
  const t = s.trim();
  if (!t || /^[A-Z]{2,}/.test(t) || /^I\b/.test(t)) return t;
  return t[0].toLowerCase() + t.slice(1);
}

/** The next follow-up to ask, or null when there's nothing worth asking.
 *  `asked` holds ids already answered or dismissed; those never come back. */
export function pickFollowUp(facts: KnownFact[], asked: readonly string[]): FollowUp | null {
  const done = new Set(asked);
  const answered = new Set(facts.map((f) => f.slotKey).filter((k): k is string => Boolean(k)));
  const open = (q: Candidate) => !done.has(q.slotKey) && !answered.has(q.slotKey);

  // 1. Dig into what the student said in onboarding.
  const said = (key: string) => facts.filter((f) => f.slotKey === key && !f.unconfirmed).map((f) => f.fact);
  for (const fact of said("onbSlip")) {
    const hit = SLIP_FOLLOW_UPS.find((s) => s.match.test(fact));
    if (hit && open(hit.q)) return withId(hit.q);
  }
  for (const fact of said("onbMatters")) {
    const hit = MATTER_FOLLOW_UPS.find((s) => s.match.test(fact) && open(s.q));
    if (hit) return withId(hit.q);
  }

  // 2. Check something Tangent only guessed.
  const guess = facts.find((f) => f.unconfirmed && f.fact.trim() && !done.has(`check-${f.id}`));
  if (guess) {
    return {
      id: `check-${guess.id}`,
      ask: `Tangent picked up that ${lowerFirst(guess.fact).replace(/[.\s]+$/, "")}. Is that right?`,
      why: "Guesses aren't used until you say so.",
      placeholder: "Yes, no, or say it your way",
      factCategory: guess.factCategory ?? factCategoryFor(guess.category ?? "general", guess.fact),
      slotKey: "fuCheck",
      lead: "",
      checkId: guess.id,
    };
  }

  // 3. A whole area Tangent knows nothing about.
  const known = new Set(
    facts.filter((f) => !f.unconfirmed).map((f) => f.factCategory ?? factCategoryFor(f.category ?? "general", f.fact))
  );
  const area = AREA_FOLLOW_UPS.find((q) => !known.has(q.factCategory) && open(q));
  return area ? withId(area) : null;
}

/** A follow-up by id, rebuilt on the server so an answer is saved with the
 *  real lead, category and slot key, never ones sent by the browser. */
export function followUpById(id: string, facts: KnownFact[]): FollowUp | null {
  if (id.startsWith("check-")) {
    const guess = facts.find((f) => `check-${f.id}` === id && f.unconfirmed);
    if (!guess) return null;
    return pickFollowUp([guess], [])?.id === id ? pickFollowUp([guess], []) : null;
  }
  const all = [...SLIP_FOLLOW_UPS.map((s) => s.q), ...MATTER_FOLLOW_UPS.map((s) => s.q), ...AREA_FOLLOW_UPS];
  const q = all.find((c) => c.slotKey === id);
  return q ? withId(q) : null;
}

export type FollowUpReply =
  | { kind: "distress" }
  | { kind: "empty" }
  | { kind: "confirm" }
  | { kind: "reject" }
  | { kind: "fact"; fact: string };

const YES = /^(?:yes|yeah|yep|yup|ya|right|correct|true|that's right|exactly)\b[.!\s]*$/i;
const NO = /^(?:no|nope|nah|not really|wrong|not true|that's wrong)\b[.!\s]*$/i;

/** What to do with a typed answer. A real answer becomes a fact; a vague one
 *  ("idk") is let go quietly; distress gets a kind reply and nothing saved. */
export function replyFor(followUp: Pick<FollowUp, "lead" | "checkId">, answer: string): FollowUpReply {
  const text = answer.replace(/\s+/g, " ").trim().slice(0, 300);
  if (looksDistressed(text)) return { kind: "distress" };
  if (followUp.checkId) {
    if (YES.test(text)) return { kind: "confirm" };
    if (NO.test(text)) return { kind: "reject" };
  }
  if (!text || isVagueValue(text)) return { kind: "empty" };
  return { kind: "fact", fact: `${followUp.lead}${followUp.lead ? lowerFirst(text) : text}`.replace(/[.\s]+$/, "") };
}

// ─── At most one a day ──────────────────────────────────────────────────────

export type FollowUpState = {
  v: 1;
  /** The local day (YYYY-MM-DD) one was last shown, answered or dismissed. */
  day: string | null;
  /** Showing until it's answered or dismissed, across days. */
  current: FollowUp | null;
  /** Answered or dismissed ids. */
  asked: string[];
};

export const EMPTY_FOLLOW_UP_STATE: FollowUpState = { v: 1, day: null, current: null, asked: [] };

const MAX_ASKED = 200;

export function followUpStorageKey(userKey: string): string {
  return `tangent-follow-up:${userKey.trim().toLowerCase()}`;
}

function parseFollowUp(raw: unknown): FollowUp | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : null);
  const id = s("id");
  const ask = s("ask");
  const slotKey = s("slotKey");
  const factCategory = s("factCategory");
  if (!id || !ask || !slotKey || !/^[a-zA-Z]{1,32}$/.test(slotKey) || !isFactCategory(factCategory)) return null;
  return {
    id,
    ask,
    why: s("why") ?? "",
    placeholder: s("placeholder") ?? "",
    factCategory,
    slotKey,
    lead: s("lead") ?? "",
    ...(s("checkId") ? { checkId: s("checkId") as string } : {}),
  };
}

export function parseFollowUpState(raw: string | null | undefined): FollowUpState {
  if (!raw) return EMPTY_FOLLOW_UP_STATE;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (!d || d.v !== 1) return EMPTY_FOLLOW_UP_STATE;
    return {
      v: 1,
      day: typeof d.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : null,
      current: parseFollowUp(d.current),
      asked: Array.isArray(d.asked) ? d.asked.filter((a): a is string => typeof a === "string").slice(-MAX_ASKED) : [],
    };
  } catch {
    return EMPTY_FOLLOW_UP_STATE;
  }
}

/** What the bubble does on a given day: keep showing the open one, ask the
 *  server for a new one, or stay away until tomorrow. */
export function followUpToday(state: FollowUpState, today: string): "show" | "fetch" | "none" {
  if (state.current) return "show";
  return state.day === today ? "none" : "fetch";
}

/** After a fetch: the new question (or none today). */
export function withQuestion(state: FollowUpState, today: string, q: FollowUp | null): FollowUpState {
  return { ...state, day: today, current: q };
}

/** Answered or dismissed: it never comes back, and nothing more today. */
export function closeFollowUp(state: FollowUpState, today: string): FollowUpState {
  const id = state.current?.id;
  const asked = id && !state.asked.includes(id) ? [...state.asked, id].slice(-MAX_ASKED) : state.asked;
  return { ...state, day: today, current: null, asked };
}
