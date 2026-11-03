// Tangent never guesses how long a plan should run. No deadline, nothing known:
// it asks "By when?" once (lib/ai/plan-brief.ts, lib/ai/clarify.ts). Skipped, it
// plans one week and says so on the preview. Pure, so the ranges are unit tested.

export const PICK_DATE = "Pick a date";
export const SKIP_ANSWER = "Skip";
export const TIMEFRAME_OPTIONS = ["This week", "2 weeks", "1 month", PICK_DATE];
export const TIMEFRAME_QUESTION = "By when?";
export const IF_SKIPPED = "We'll plan 1 week. You can change it with Edit.";
export const NO_TIMEFRAME_NOTE = "No timeframe given, so we planned 1 week. Change it with Edit.";

const ASKED = /^- (?:By when\?|When is the exam\?|When is the deadline or event\?) (.+)$/m;

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** The end date a tapped answer means, or null when the answer isn't one of the
 *  chips (a typed answer goes through the drafter's usual date reading). */
export function answeredEndDate(text: string, today: string): string | null {
  const answer = text.match(ASKED)?.[1]?.trim();
  if (!answer) return null;
  if (/^this week$/i.test(answer)) {
    const [y, m, d] = today.split("-").map(Number);
    const toSunday = (7 - new Date(Date.UTC(y, m - 1, d)).getUTCDay()) % 7;
    // Asked on a weekend, "this week" still needs a little room to plan in.
    return addDays(today, Math.max(toSunday, 2));
  }
  if (/^2 weeks$/i.test(answer)) return addDays(today, 13);
  if (/^1 month$/i.test(answer)) return addDays(today, 29);
  return /^\d{4}-\d{2}-\d{2}$/.test(answer) && answer >= today ? answer : null;
}

/** The request without what only sounds like a duration: the wording of Tangent's
 *  own questions ("How many times a week…") and a frequency ("3 times a week"). */
export function withoutFrequencies(text: string): string {
  return text
    .replace(/^- [^?\n]*\?/gm, "-")
    .replace(/\b[\w–-]+ (?:times?|hours?|hrs?|h|min(?:ute)?s?|sessions?|days?|x)(?: a| per| each| every) (?:week|month)\b/gi, "")
    .replace(/\b(?:once|twice) (?:a|per|each|every) (?:week|month)\b/gi, "");
}
