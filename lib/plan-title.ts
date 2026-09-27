// Plan titles. The planner returns a short title in the same structured
// response as the tasks (no extra call); when it's missing or generic, the
// title falls back to a cleaned-up version of what the student asked for.

const MAX_TITLE_LENGTH = 60;
const GENERIC_TITLES = new Set(["new plan", "plan", "my plan", "untitled", "untitled plan", "study plan", "task plan"]);
export const LAST_RESORT_PLAN_TITLE = "New Plan";

/** Trims, collapses whitespace, strips wrapping quotes and trailing
 *  punctuation, and shortens at a word boundary. */
function tidy(raw: string, max = MAX_TITLE_LENGTH): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^["'“‘]+|["'”’]+$/g, "").trim();
  s = s.replace(/[\s.,;:!?-]+$/, "");
  if (s.length > max) {
    const cut = s.slice(0, max + 1);
    const space = cut.lastIndexOf(" ");
    s = (space > max / 2 ? cut.slice(0, space) : s.slice(0, max)).replace(/[\s.,;:!?-]+$/, "");
  }
  return s;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Leading filler in spoken/typed requests, removed repeatedly from the front:
// "hey tangent, can you please make me a plan to study for my chem test".
const FILLER: RegExp[] = [
  /^(hey|hi|ok(ay)?|so|um+|uh+)\b[\s,]*/i,
  /^tangent\b[\s,]*/i,
  /^(can|could|would|will) you\s+/i,
  /^please\s+/i,
  /^i('d| would)? (want|need|like)( you)? to\s+/i,
  /^(help|helping) me( to)?\s+/i,
  /^(make|create|build|give|set up|draft|generate|plan)( me)?( up)?( out)?\s+/i,
  /^(a|an|the)\s+/i,
  /^((\d+|one|two|three|four|six)[- ](day|week|month)s?|daily|weekly|study|practice|training|learning|revision|review)\s+(?=((\d+|one|two|three|four|six)[- ](day|week|month)s?\s+|daily\s+|weekly\s+|study\s+|practice\s+|training\s+|learning\s+|revision\s+|review\s+)*(plan|schedule)\b)/i,
  /^(plan|schedule|routine)\s+(to|for|on|about|around|from|of|so( that)? i can)\s+/i,
  /^(plan|schedule|routine)$/i,
];

/** "hey tangent can you make me a plan to get better at chess?" → "Get better at chess" */
export function titleFromRequest(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 12; guard++) {
    const before = s;
    for (const re of FILLER) s = s.replace(re, "").trim();
    if (s === before) break;
  }
  return capitalize(tidy(s));
}

/** The planner's title when it's usable, else the student's own words. */
export function resolvePlanTitle(modelTitle: unknown, requestText: string): string {
  if (typeof modelTitle === "string") {
    const t = tidy(modelTitle);
    if (t && !GENERIC_TITLES.has(t.toLowerCase())) return capitalize(t);
  }
  return titleFromRequest(requestText) || LAST_RESORT_PLAN_TITLE;
}
