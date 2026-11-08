// Layer 3 of the context engine: which questions a goal earns, by goal type.
// Server-side config: only lib/context/* and API routes import this, never a
// client component. Pure, so it runs under plain Node in tests.
//
// Every goal type shares the generic slots (outcome, why, starting point,
// horizon, time per week, past attempts) and adds its own. Must-haves are the
// few Tangent can't plan well without; once they're filled (or skipped) it
// says "I have enough to start round 1" and drafts. 1–3 questions a turn,
// 2–5 in all, never a loop.

import { SLOT_DEFAULTS, isGlobalSlotKey, isSlotKey, slotValue, type GlobalSlotKey, type SlotKey, type SlotMap, type SlotValue } from "./slots";

export const GOAL_TYPES = ["general", "exam", "creator", "club", "essay"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Slots beyond lib/context/slots.ts's seven. Stored in context_slots too. */
export const EXTRA_SLOT_KEYS = [
  "why",
  "pastAttempts",
  "weakTopics",
  "platform",
  "followers",
  "niche",
  "postingFrequency",
  "whatWorks",
  "approvalSteps",
  "members",
  "advisor",
  "essayPrompt",
  "drafts",
] as const;
export type ExtraSlotKey = (typeof EXTRA_SLOT_KEYS)[number];

/** Facts about the student, not one project: asked once, kept for every goal
 *  (stored with project_id null). */
export const STUDENT_EXTRA_SLOTS: readonly ExtraSlotKey[] = ["platform", "followers", "niche", "postingFrequency", "whatWorks"];

export type QuestionSlot = SlotKey | GlobalSlotKey | ExtraSlotKey;

export function isExtraSlotKey(key: string): key is ExtraSlotKey {
  return (EXTRA_SLOT_KEYS as readonly string[]).includes(key);
}

export function isStudentSlot(key: string): boolean {
  return isGlobalSlotKey(key) || (STUDENT_EXTRA_SLOTS as readonly string[]).includes(key);
}

export function isQuestionSlot(key: string): key is QuestionSlot {
  return isSlotKey(key) || isGlobalSlotKey(key) || isExtraSlotKey(key);
}

type GoalConfig = {
  /** Can't plan well without these. Asked first, most important first. */
  must: QuestionSlot[];
  /** Help, but never worth a second turn. Only used to make the first turn
   *  two questions instead of one. */
  nice: QuestionSlot[];
};

export const GOAL_SLOTS: Record<GoalType, GoalConfig> = {
  general: { must: ["outcome", "deadline", "hoursPerWeek"], nice: ["currentLevel", "why", "pastAttempts"] },
  exam: { must: ["deadline", "outcome", "weakTopics", "hoursPerWeek"], nice: ["currentLevel", "pastAttempts"] },
  creator: { must: ["platform", "followers", "niche", "hoursPerWeek"], nice: ["outcome", "postingFrequency", "whatWorks"] },
  club: { must: ["outcome", "approvalSteps", "deadline"], nice: ["members", "advisor", "hoursPerWeek"] },
  essay: { must: ["deadline", "essayPrompt", "drafts"], nice: ["hoursPerWeek", "outcome"] },
};

export const MAX_PER_TURN = 3;
export const MAX_TOTAL = 5;
export const ENOUGH_MESSAGE = "I have enough to start round 1. Add anything else anytime.";

const GOAL_PATTERNS: [GoalType, RegExp][] = [
  ["essay", /\b(essays?|personal statement|college app\w*|common app|supplements?|scholarship|application)\b/i],
  ["creator", /\b(instagram|insta|tiktok|youtube|twitch|substack|podcast|snapchat|followers|subscribers|subs|content creator|my channel|grow my (account|page|channel)|go viral|posting)\b/i],
  ["club", /\b(clubs?|start a team|chapter|student council|organi[sz]ation|fundraiser|club president)\b/i],
  ["exam", /\b(sat|act|psat|ap [a-z]+ exam|ap exam|exams?|tests?|finals?|midterms?|quiz|mcat|lsat|ielts|toefl|regents|score)\b/i],
];

/** What kind of goal the words describe; "general" when nothing stands out. */
export function goalTypeOf(text: string): GoalType {
  return GOAL_PATTERNS.find(([, re]) => re.test(text))?.[0] ?? "general";
}

// ─── Questions ──────────────────────────────────────────────────────────────

export type SlotQuestionCard = {
  slot: QuestionSlot;
  question: string;
  options: string[];
  multi?: boolean;
  /** What Tangent goes with if this is skipped. */
  assume?: string;
};

type Template = { ask: (title: string, type: GoalType) => string; options: string[] | ((type: GoalType) => string[]); multi?: boolean; assume?: string };

const TIMES = ["Mornings", "After school", "Evenings", "Weekends"];

const TEMPLATES: Record<QuestionSlot, Template> = {
  outcome: {
    ask: (t, type) =>
      type === "exam" ? `What score are you aiming for on ${t}?` : type === "club" ? `What does ${t} look like when it's up and running?` : type === "creator" ? "What would count as a win?" : `What does done look like for ${t}?`,
    options: (type) =>
      type === "exam" ? ["Just pass", "A solid score", "A top score"] : type === "creator" ? ["More followers", "Steady posting", "A first brand deal"] : ["Finish it", "A top result", "Just get started"],
  },
  deadline: {
    ask: (t, type) => (type === "exam" ? `When is ${t}?` : type === "essay" ? `When is ${t} due?` : `When does ${t} need to be done?`),
    options: ["This week", "2 weeks", "1 month", "End of term"],
    assume: `about ${SLOT_DEFAULTS.deadline}`,
  },
  hoursPerWeek: {
    ask: () => "How many hours a week can you give this?",
    options: ["1–2", "3–5", "6–10", "10+"],
    assume: `about ${SLOT_DEFAULTS.hoursPerWeek} hours a week`,
  },
  currentLevel: { ask: () => "Where are you starting from?", options: ["Brand new", "Know the basics", "Pretty solid", "Just polishing"] },
  hardestPart: { ask: (t) => `What's the hardest part of ${t}?`, options: ["Getting started", "Staying consistent", "The material", "Finding time"] },
  constraints: { ask: (t) => `Anything fixed to plan ${t} around?`, options: ["Sports or practice", "A job", "Family stuff", "Nothing fixed"] },
  bestTimeForThis: { ask: (t) => `When do you want to work on ${t}?`, options: TIMES, multi: true },
  preferredWorkTimes: { ask: () => "When do you usually like to work?", options: TIMES, multi: true },
  focusLength: { ask: () => "How long can you focus in one go?", options: ["25 min", "45 min", "1 hr", "90 min"] },
  weekendAvailability: { ask: () => "How free are your weekends?", options: ["Pretty free", "Some time", "Busy", "Off-limits"] },
  why: { ask: (t) => `Why does ${t} matter to you?`, options: ["For college", "For me", "Someone's counting on me", "It's required"] },
  pastAttempts: { ask: () => "Have you tried this before?", options: ["First time", "Tried, didn't stick", "Done it before"] },
  weakTopics: { ask: (t) => `Which parts of ${t} feel weakest?`, options: ["Math", "Reading", "Writing", "Not sure yet"] },
  platform: { ask: () => "Which platform?", options: ["Instagram", "TikTok", "YouTube", "Other"] },
  followers: { ask: () => "About how many followers do you have now?", options: ["Under 100", "100–1k", "1k–10k", "10k+"] },
  niche: { ask: () => "What's your account about?", options: ["Sports", "Art or design", "Gaming", "Lifestyle"] },
  postingFrequency: { ask: () => "How often do you post now?", options: ["Rarely", "Weekly", "A few times a week", "Daily"] },
  whatWorks: { ask: () => "What kind of post has done best so far?", options: ["Videos", "Photos", "Tutorials", "Not sure yet"] },
  approvalSteps: { ask: (t) => `What does ${t} need approved, and by whom?`, options: ["The school", "An advisor", "Student council", "Not sure yet"] },
  members: { ask: () => "How many people are in so far?", options: ["Just me", "2–5", "6–15", "16+"] },
  advisor: { ask: () => "Do you have a teacher advisor yet?", options: ["Yes", "Asking one", "Not yet"] },
  essayPrompt: { ask: () => "What's the prompt, roughly?", options: ["About me", "Why this school", "A challenge I faced", "Not picked yet"] },
  drafts: { ask: () => "How far along is it?", options: ["Not started", "Some notes", "A rough draft", "Almost done"] },
};

export function questionCard(slot: QuestionSlot, title: string | undefined, type: GoalType): SlotQuestionCard {
  const tpl = TEMPLATES[slot];
  const t = title?.trim() || "this";
  const options = typeof tpl.options === "function" ? tpl.options(type) : tpl.options;
  return { slot, question: tpl.ask(t, type), options, ...(tpl.multi ? { multi: true } : {}), ...(tpl.assume ? { assume: tpl.assume } : {}) };
}

// ─── Reading the words first ────────────────────────────────────────────────

const PLATFORM: [RegExp, string][] = [
  [/\b(instagram|insta|ig)\b/i, "Instagram"],
  [/\btiktok\b/i, "TikTok"],
  [/\b(youtube|yt)\b/i, "YouTube"],
  [/\btwitch\b/i, "Twitch"],
  [/\bsubstack\b/i, "Substack"],
  [/\bpodcast\b/i, "Podcast"],
  [/\bsnapchat\b/i, "Snapchat"],
];
const FOLLOWERS = /\b(\d[\d,.]*\s*k?|zero|no)\s*(?:followers|subs|subscribers)\b/i;
const NICHE = /\b(?:my (?:account|page|channel) is about|(?:account|page|channel|content) (?:is )?about|posts? about|videos? about|niche is)\s+([a-z0-9 '&-]{3,40}?)(?=[.,!?]|\s+(?:and|but|to|so|from|in|by)\b|$)/i;
const POSTING = /\b(?:post(?:ing)?\s+)?((?:once|twice|\d+\s*(?:times|x))\s*(?:a|per)\s*(?:day|week)|daily|every day|weekly)\b/i;
const WEAK = /\b(?:weak(?:est)? (?:at|in|on)|struggl\w* with|bad at|trouble with|need help (?:with|on))\s+(.{2,60}?)(?=[.,!?]|\s+(?:and i|but|so)\b|$)/i;
const DRAFTS = /\b(no draft|haven'?t (?:started|written)|not started|(?:first|rough|second|final) draft|some notes|almost done)\b/i;
const PROMPT = /\bprompt (?:is|:)\s*(.{5,120}?)(?=[.!?]|$)/i;
const MEMBERS = /\b(\d+)\s*(?:members|people|students|of us)\b/i;
const ADVISOR = /\b(?:advisor|sponsor)(?: is)?\s+((?:mr|mrs|ms|mx|dr)\.?\s+[a-z]+)/i;
const WHY = /\b(?:because|so (?:that )?i can|for my)\s+(.{3,80}?)(?=[.!?]|$)/i;
const PAST = /\b(tried (?:it )?before|last time|again|retak\w+|second time|third time)\b/i;
const APPROVAL = /\b(?:needs?|get|getting)\s+(?:it\s+)?(?:approved|approval|signed off)\s+(?:by|from)\s+(.{3,40}?)(?=[.,!?]|$)/i;

/** Extra slots the words already answer, so Tangent never asks them. */
export function inferExtraSlots(text: string, now: Date = new Date()): SlotMap<ExtraSlotKey> {
  const t = text.replace(/\s+/g, " ").trim();
  const out: SlotMap<ExtraSlotKey> = {};
  if (!t) return out;
  const v = (s: string) => slotValue(s.trim().slice(0, 120), "inferred", now);
  const platform = PLATFORM.find(([re]) => re.test(t));
  if (platform) out.platform = v(platform[1]);
  const followers = t.match(FOLLOWERS);
  if (followers) out.followers = v(/^(zero|no)$/i.test(followers[1]) ? "0" : followers[1].replace(/\s+/g, ""));
  const niche = t.match(NICHE);
  if (niche) out.niche = v(niche[1]);
  const posting = t.match(POSTING);
  if (posting) out.postingFrequency = v(posting[1]);
  const weak = t.match(WEAK);
  if (weak) out.weakTopics = v(weak[1]);
  const drafts = t.match(DRAFTS);
  if (drafts) out.drafts = v(drafts[1]);
  const prompt = t.match(PROMPT);
  if (prompt) out.essayPrompt = v(prompt[1]);
  const members = t.match(MEMBERS);
  if (members) out.members = v(members[1]);
  const advisor = t.match(ADVISOR);
  if (advisor) out.advisor = v(advisor[1]);
  const why = t.match(WHY);
  if (why) out.why = v(why[1]);
  const past = t.match(PAST);
  if (past) out.pastAttempts = v("Tried before");
  const approval = t.match(APPROVAL);
  if (approval) out.approvalSteps = v(approval[1]);
  return out;
}

// ─── The turn ───────────────────────────────────────────────────────────────

export type QuestionState = {
  type: GoalType;
  /** Every slot with a value, whatever its source (said, known, answered). */
  filled: ReadonlySet<string>;
  /** Skipped this session: never asked again. */
  skipped: ReadonlySet<string>;
  /** Questions asked so far this session (answered + skipped). */
  asked: number;
  stopped: boolean;
  /** The student's once-ever work-time question is still open. */
  workTimeOpen?: boolean;
};

export type QuestionTurn =
  | { type: "ask"; slots: QuestionSlot[]; progress: number }
  | { type: "draft"; enough: boolean; progress: number; openMust: QuestionSlot[] };

/** 0–1: how many must-haves are settled. */
function progressOf(must: QuestionSlot[], s: QuestionState): number {
  if (!must.length) return 1;
  const done = must.filter((k) => s.filled.has(k) || s.skipped.has(k)).length;
  return Math.round((done / must.length) * 100) / 100;
}

/**
 * The next 1–3 questions, or draft. Must-haves first; the first turn is padded
 * to two questions with the most useful nice-to-have. A must-have that's
 * skipped counts as settled (deadline and hours fall back to defaults), so this
 * never loops, and it stops at MAX_TOTAL whatever is left.
 */
export function nextQuestions(s: QuestionState): QuestionTurn {
  const { must, nice } = GOAL_SLOTS[s.type];
  const progress = progressOf(must, s);
  const open = (list: QuestionSlot[]) => list.filter((k) => !s.filled.has(k) && !s.skipped.has(k));
  const openMust = open(must);
  const budget = Math.min(MAX_PER_TURN, MAX_TOTAL - s.asked);
  if (s.stopped || budget <= 0 || openMust.length === 0) {
    return { type: "draft", enough: openMust.length === 0, progress, openMust };
  }
  const slots = openMust.slice(0, budget);
  if (s.asked === 0 && slots.length < 2) {
    const pad: QuestionSlot[] = s.workTimeOpen ? ["preferredWorkTimes" as QuestionSlot, ...open(nice)] : open(nice);
    const extra = pad.find((k) => !slots.includes(k));
    if (extra) slots.push(extra);
  }
  return { type: "ask", slots, progress };
}

/** Skipping deadline or hours applies Tangent's default. */
export function defaultFor(slot: QuestionSlot, now: Date = new Date()): SlotValue | null {
  if (slot === "deadline") return slotValue(SLOT_DEFAULTS.deadline, "default", now);
  if (slot === "hoursPerWeek") return slotValue(SLOT_DEFAULTS.hoursPerWeek, "default", now);
  return null;
}

/** The form label a slot answer is filed under (lib/student/facts.ts turns it
 *  into a second-person sentence). */
export const SLOT_FACT_LABEL: Record<QuestionSlot, string> = {
  outcome: "Goal",
  deadline: "Deadline",
  hoursPerWeek: "Hours a week",
  currentLevel: "Level",
  hardestPart: "Hardest part",
  constraints: "Plan around",
  bestTimeForThis: "Best time to work",
  preferredWorkTimes: "Likes to work",
  focusLength: "Focus length",
  weekendAvailability: "Weekends",
  why: "Why it matters",
  pastAttempts: "Tried before",
  weakTopics: "Weakest parts",
  platform: "Platform",
  followers: "Followers",
  niche: "Account is about",
  postingFrequency: "Posts",
  whatWorks: "Best posts so far",
  approvalSteps: "Needs approval from",
  members: "Members so far",
  advisor: "Advisor",
  essayPrompt: "Essay prompt",
  drafts: "Draft so far",
};
