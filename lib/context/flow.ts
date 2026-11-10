// "Grill until enough": one question at a time, heaviest gap first, until
// Tangent knows enough to draft (lib/context/slots.ts ENOUGH), the student
// stops, or nothing is left. Questions come from templates, so asking costs
// no AI. Pure: the chat route keeps the state between turns.

import {
  ENOUGH,
  REQUIRED_SLOTS,
  SLOT_DEFAULTS,
  SLOT_WEIGHTS,
  isGlobalSlotKey,
  slotValue,
  valueText,
  type AnySlot,
  type GlobalSlotKey,
  type SlotKey,
  type SlotMap,
  type SlotValue,
  type Sufficiency,
} from "./slots";

export type FlowState = {
  answered: SlotMap<SlotKey>;
  skipped: SlotKey[];
  /** Questions answered or skipped since the last check-in. */
  inARow: number;
  stopped: boolean;
  askedGlobal: GlobalSlotKey[];
};

export type SlotQuestion = {
  slot: AnySlot;
  question: string;
  options: string[];
  multi?: boolean;
  /** What Tangent goes with if this is skipped. */
  assume?: string;
};

export type FlowStep =
  | { type: "ask"; slot: AnySlot; card: SlotQuestion; score: number }
  | { type: "check_in"; score: number }
  | { type: "draft"; assumptions: string[]; queueSlots: SlotKey[] };

/** After this many questions in a row, Tangent offers to plan now. */
export const CHECK_IN_AFTER = 5;
export const CHECK_IN_QUESTION = "Want to keep going or plan now?";
export const KEEP_GOING = "Keep going";
export const PLAN_NOW = "Plan now";

export const EMPTY_FLOW: FlowState = { answered: {}, skipped: [], inARow: 0, stopped: false, askedGlobal: [] };

const TIMES = ["Mornings", "After school", "Evenings", "Weekends"];

type Template = { ask: (title: string) => string; options: string[]; multi?: boolean; assume?: string };

const TEMPLATES: Record<AnySlot, Template> = {
  outcome: { ask: (t) => `What does done look like for ${t}?`, options: ["Pass it", "A top result", "Finish it", "Just get started"] },
  deadline: {
    ask: (t) => `When does ${t} need to be done?`,
    options: ["This week", "2 weeks", "1 month", "No real deadline"],
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
};

export function slotQuestion(slot: AnySlot, context: { title?: string } = {}): SlotQuestion {
  const tpl = TEMPLATES[slot];
  const title = context.title?.trim() || "this";
  return { slot, question: tpl.ask(title), options: tpl.options, ...(tpl.multi ? { multi: true } : {}), ...(tpl.assume ? { assume: tpl.assume } : {}) };
}

/** A tapped or typed answer as a slot value. Ranges become their middle. */
export function parseSlotAnswer(slot: AnySlot, answer: string, now: Date = new Date()): SlotValue {
  const a = answer.trim();
  if (slot === "hoursPerWeek") {
    const range = a.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
    if (range) return slotValue((Number(range[1]) + Number(range[2])) / 2, "answer", now);
    const one = a.match(/\d+(?:\.\d+)?/);
    if (one) return slotValue(Number(one[0]), "answer", now);
  }
  if (slot === "bestTimeForThis" || slot === "preferredWorkTimes") {
    return slotValue(a.split(/\s*,\s*/).filter(Boolean), "answer", now);
  }
  return slotValue(a.slice(0, 200), "answer", now);
}

/** Skipping deadline or hours applies the default and counts as filled;
 *  skipping anything else drops it for this session. Never loops. */
export function skipSlot(state: FlowState, slot: AnySlot, now: Date = new Date()): FlowState {
  const next = { ...state, inARow: state.inARow + 1 };
  if (isGlobalSlotKey(slot)) {
    // A skipped work-time question also covers this project's work time.
    return { ...next, askedGlobal: addOnce(state.askedGlobal, slot), skipped: addOnce(state.skipped, "bestTimeForThis" as SlotKey) };
  }
  if (slot === "deadline") return { ...next, answered: { ...state.answered, deadline: slotValue(SLOT_DEFAULTS.deadline, "default", now) } };
  if (slot === "hoursPerWeek") return { ...next, answered: { ...state.answered, hoursPerWeek: slotValue(SLOT_DEFAULTS.hoursPerWeek, "default", now) } };
  return { ...next, skipped: addOnce(state.skipped, slot) };
}

export function answerSlot(state: FlowState, slot: AnySlot, answer: string, now: Date = new Date()): FlowState {
  if (isGlobalSlotKey(slot)) return { ...state, inARow: state.inARow + 1, askedGlobal: addOnce(state.askedGlobal, slot) };
  return { ...state, inARow: state.inARow + 1, answered: { ...state.answered, [slot]: parseSlotAnswer(slot, answer, now) } };
}

/** The list with `item` added, once. */
function addOnce<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list : [...list, item];
}

function assumptionsFor(answered: SlotMap<SlotKey>, missing: SlotKey[]): string[] {
  const out: string[] = [];
  const deadline = answered.deadline;
  const hours = answered.hoursPerWeek;
  if ((deadline?.source === "default") || missing.includes("deadline")) out.push(`Finish in about ${SLOT_DEFAULTS.deadline}`);
  if ((hours?.source === "default") || missing.includes("hoursPerWeek")) out.push(`About ${SLOT_DEFAULTS.hoursPerWeek} hours a week`);
  return out;
}

function draft(state: FlowState, sufficiency: Sufficiency): FlowStep {
  const missing = sufficiency.missing.filter((s) => !state.answered[s]);
  return {
    type: "draft",
    assumptions: assumptionsFor(state.answered, missing),
    queueSlots: missing.filter((s) => !REQUIRED_SLOTS.includes(s)),
  };
}

/** What happens next. `sufficiency` is computed with `state.answered` merged in. */
export function nextStep(
  state: FlowState,
  sufficiency: Sufficiency,
  global: SlotMap<GlobalSlotKey>,
  context: { title?: string } = {},
): FlowStep {
  if (state.stopped) return draft(state, sufficiency);
  const open = sufficiency.missing.filter((s) => !state.skipped.includes(s) && !state.answered[s]);
  const requiredOpen = REQUIRED_SLOTS.filter((s) => open.includes(s));
  if (sufficiency.score >= ENOUGH && requiredOpen.length === 0) return draft(state, sufficiency);
  if (open.length === 0) return draft(state, sufficiency);
  if (state.inARow >= CHECK_IN_AFTER) return { type: "check_in", score: sufficiency.score };

  let slot: AnySlot = requiredOpen[0] ?? open[0];
  // The once-ever work-time question comes before the rest: it helps every plan.
  if (!requiredOpen.length && open.includes("bestTimeForThis") && !global.preferredWorkTimes && !state.askedGlobal.includes("preferredWorkTimes")) {
    slot = "preferredWorkTimes";
  }
  return { type: "ask", slot, card: slotQuestion(slot, context), score: sufficiency.score };
}

/** A fact for "What Tangent knows". */
export function slotToFact(slot: AnySlot, value: SlotValue, projectTitle?: string): string {
  const v = valueText(slot, value);
  const about = projectTitle?.trim() ? ` for ${projectTitle.trim()}` : "";
  switch (slot) {
    case "outcome": return `Goal${about}: ${v}`;
    case "deadline": return `Deadline${about}: ${v}`;
    case "hoursPerWeek": return `Can give ${v}${about}`;
    case "currentLevel": return `Level${about}: ${v}`;
    case "hardestPart": return `Hardest part${about}: ${v}`;
    case "constraints": return `Plan around${about}: ${v}`;
    case "bestTimeForThis": return `Best time to work${about}: ${v}`;
    case "preferredWorkTimes": return `Likes to work: ${v}`;
    case "focusLength": return `Can focus for about ${v} at a time`;
    case "weekendAvailability": return `Weekends: ${v}`;
  }
}

export type ProjectSufficiency = { projectId: string; title: string; score: number; missing: SlotKey[] };
export type QueuedSlot = { projectId: string; title: string; slot: SlotKey; priority: number };

/** Every project's open slots, most useful first: (1 − score) × weight. */
export function rankSlotQueue(projects: ProjectSufficiency[]): QueuedSlot[] {
  return projects
    .flatMap((p) => p.missing.map((slot) => ({ projectId: p.projectId, title: p.title, slot, priority: Math.round((1 - p.score) * SLOT_WEIGHTS[slot] * 1000) / 1000 })))
    .sort((a, b) => b.priority - a.priority);
}

const PLAN_SHAPING: SlotKey[] = ["deadline", "hoursPerWeek", "bestTimeForThis", "constraints"];

/** Whether a new answer should offer to re-plan the project. */
export function answerChangesPlan(slot: SlotKey, before: SlotValue | undefined, after: SlotValue): boolean {
  if (!PLAN_SHAPING.includes(slot)) return false;
  if (!before) return true;
  return valueText(slot, before).toLowerCase() !== valueText(slot, after).toLowerCase();
}

const WINDOWS: Record<string, { start: number; end: number }> = {
  mornings: { start: 6 * 60, end: 9 * 60 },
  "after school": { start: 15 * 60, end: 18 * 60 },
  evenings: { start: 19 * 60, end: 22 * 60 },
  "late night": { start: 21 * 60, end: 23 * 60 },
};

/** Minutes-of-day windows for lib/load.ts placement. Weekends alone set none. */
export function preferredWindows(slot: SlotValue | undefined): { start: number; end: number }[] | undefined {
  if (!slot) return undefined;
  const picks = (Array.isArray(slot.value) ? slot.value : String(slot.value).split(/\s*,\s*/)).map((v) => String(v).toLowerCase());
  const windows = picks.map((p) => WINDOWS[p]).filter((w): w is { start: number; end: number } => Boolean(w));
  return windows.length ? windows : undefined;
}
