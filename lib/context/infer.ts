// What a request already says, so Tangent never asks it. Rules first, free and
// instant; one fast model call only when the rules find nothing to go on.

import { slotValue, type SlotKey, type SlotMap } from "./slots";

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const DEADLINE = new RegExp(
  [
    `\\bin (?:a|an|one|two|three|four|five|six|\\d+) (?:day|week|month)s?\\b`,
    `\\b(?:by|before|on) (?:${MONTHS})[a-z]*\\.? \\d{1,2}(?:st|nd|rd|th)?\\b`,
    `\\b(?:by|before|on) (?:mon|tues|wednes|thurs|fri|satur|sun)day\\b`,
    `\\b(?:by|before) (?:next week|next month|the end of (?:the )?(?:week|month|term|semester|year))\\b`,
    `\\b(?:this|next) (?:week|weekend|month)\\b`,
    `\\btomorrow\\b`,
    `\\b\\d{4}-\\d{2}-\\d{2}\\b`,
  ].join("|"),
  "i",
);
const HOURS_WEEK = /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:a|per|each|every)\s*week\b/i;
const PER_DAY = /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\s*(?:a|per|each|every)\s*day\b/i;
const OUTCOME = /\b(?:get ready for|prepare for|prep for|study for|pass|ace|learn|finish|build|train for|practice for|apply to|write|get (?:a|an) \w+ on)\s+(.{2,80}?)(?=\s+(?:in|by|before|on|this|next|tomorrow)\b|[.,!?]|$)/i;
const LEVEL: [RegExp, string][] = [
  [/\b(?:from scratch|never (?:done|tried|learned)|total beginner|brand new|new to)\b/i, "Brand new"],
  [/\b(?:retak(?:e|ing)|took it before|already know|know the basics|some experience)\b/i, "Know the basics"],
  [/\b(?:polish|fine[- ]tune|almost there|already good)\b/i, "Just polishing"],
];
const WHEN: [RegExp, string][] = [
  [/\b(?:in the |on )?mornings?\b/i, "Mornings"],
  [/\bafter school\b/i, "After school"],
  [/\b(?:in the |at )?(?:evenings?|nights?)\b/i, "Evenings"],
  [/\bweekends?\b/i, "Weekends"],
];
const CONSTRAINT = /\b(?:except |can't (?:do|work) (?:on )?|cannot (?:do|work) (?:on )?|busy on|not on|no )(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|weekends?|evenings?|mornings?)\b/i;

/** Slots the words fill, all marked "inferred". `today` is YYYY-MM-DD. */
export function inferSlotsFromText(text: string, today: string): SlotMap<SlotKey> {
  const at = new Date(`${today}T12:00:00Z`);
  const out: SlotMap<SlotKey> = {};
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return out;

  const deadline = t.match(DEADLINE);
  if (deadline) out.deadline = slotValue(deadline[0].trim(), "inferred", at);

  const week = t.match(HOURS_WEEK);
  const day = t.match(PER_DAY);
  if (week) out.hoursPerWeek = slotValue(Number(week[1]), "inferred", at);
  else if (day) {
    const n = Number(day[1]);
    const hoursPerDay = /^min/i.test(day[2]) ? n / 60 : n;
    out.hoursPerWeek = slotValue(Math.round(hoursPerDay * 5 * 2) / 2, "inferred", at);
  }

  const outcome = t.match(OUTCOME);
  if (outcome && outcome[1].trim().length >= 2) out.outcome = slotValue(outcome[0].trim(), "inferred", at);

  const level = LEVEL.find(([re]) => re.test(t));
  if (level) out.currentLevel = slotValue(level[1], "inferred", at);

  const constraint = t.match(CONSTRAINT);
  if (constraint) out.constraints = slotValue(constraint[0].trim(), "inferred", at);

  // "in the evenings" is when to work, unless it's what's ruled out.
  const when = WHEN.filter(([re]) => re.test(t.replace(CONSTRAINT, ""))).map(([, v]) => v);
  if (when.length) out.bestTimeForThis = slotValue(when, "inferred", at);

  return out;
}

/** Words for numbers, for the model's answers ("two weeks"). */
export function numberWord(word: string): number | null {
  const n = Number(word);
  if (Number.isFinite(n)) return n;
  return NUM[word.toLowerCase()] ?? null;
}

const INFER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string" },
    deadline: { type: "string" },
    hoursPerWeek: { type: "number" },
    currentLevel: { type: "string" },
  },
  required: [],
} as const;

const INFER_SYSTEM = `Read a high school student's request for a plan. Return only what it clearly states, as JSON: outcome (what done looks like, under 8 words), deadline (the timeframe in their words), hoursPerWeek (a number), currentLevel (under 4 words). Leave out anything not stated. Never guess.`;

/** Rules first. When they find neither an outcome nor a deadline in a longer
 *  request, one fast model call fills what it clearly states. Any failure
 *  returns the rules' answer: inference never blocks planning. */
export async function inferSlotsWithFallback(text: string, today: string): Promise<SlotMap<SlotKey>> {
  const ruled = inferSlotsFromText(text, today);
  if (ruled.outcome || ruled.deadline || text.trim().split(/\s+/).length < 6) return ruled;
  try {
    const [{ callClaude }, { extractStructuredJson }] = await Promise.all([import("@/lib/ai/call"), import("@/lib/anthropic-json")]);
    const result = await callClaude(
      "inferSlots",
      { system: INFER_SYSTEM, messages: [{ role: "user", content: text.slice(0, 1500) }] },
      { format: { type: "json_schema", schema: INFER_SCHEMA } },
    );
    if (!result.ok) return ruled;
    const parsed = extractStructuredJson(result.message) as Partial<Record<"outcome" | "deadline" | "currentLevel", string>> & { hoursPerWeek?: number };
    const at = new Date(`${today}T12:00:00Z`);
    const merged: SlotMap<SlotKey> = { ...ruled };
    for (const key of ["outcome", "deadline", "currentLevel"] as const) {
      const v = parsed[key]?.trim();
      if (v && !merged[key]) merged[key] = slotValue(v.slice(0, 80), "inferred", at);
    }
    if (typeof parsed.hoursPerWeek === "number" && parsed.hoursPerWeek > 0 && parsed.hoursPerWeek <= 60 && !merged.hoursPerWeek) {
      merged.hoursPerWeek = slotValue(parsed.hoursPerWeek, "inferred", at);
    }
    return merged;
  } catch {
    return ruled;
  }
}
