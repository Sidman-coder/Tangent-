// Overnight 2 (Maya sim): times the student said to keep free, read from the
// request itself ("not tue 3:30-5 (debate)", "no sessions Thursdays 4 to 6pm").
// Pure. Session times are picked in code (lib/schedule-slots.ts firstOpenTime),
// so these windows go in as busy time there; the model never has to remember.

export type AvoidWindow = { weekday: number; start: number; end: number };

const DAYS: [RegExp, number][] = [
  [/^sun/, 0],
  [/^mon/, 1],
  [/^tue/, 2],
  [/^wed/, 3],
  [/^thu/, 4],
  [/^fri/, 5],
  [/^sat/, 6],
];

const DAY = "(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:days?|nesdays?|sdays?|rsdays?|urdays?|days?)?";
const TIME = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?";
// A cue before the day says it's time to keep free, not time to use.
const CUE = "(?:not|no|never|avoid|except|busy|can'?t|cannot|don'?t|nothing)";
const RE = new RegExp(`\\b${CUE}\\b[^.;\\n]{0,20}?\\b${DAY}\\b\\.?\\s*(?:from\\s+|at\\s+)?${TIME}\\s*(?:-|–|to|until|till)\\s*${TIME}`, "gi");

function minutes(h: string, m: string | undefined, ap: string | undefined, fallbackPm: boolean): number {
  let hour = Number(h) % 24;
  const ampm = ap?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  else if (ampm === "am" && hour === 12) hour = 0;
  // "3:30-5" from a student means the afternoon.
  else if (!ampm && fallbackPm && hour >= 1 && hour < 8) hour += 12;
  return hour * 60 + Number(m ?? 0);
}

function weekdayOf(word: string): number | null {
  const w = word.toLowerCase();
  for (const [re, n] of DAYS) if (re.test(w)) return n;
  return null;
}

/** Windows the student asked to keep free, at most 6. Empty when none. */
export function avoidWindows(text: string): AvoidWindow[] {
  const out: AvoidWindow[] = [];
  for (const m of Array.from(text.matchAll(RE))) {
    const weekday = weekdayOf(m[1]);
    if (weekday === null) continue;
    const endAp = m[7];
    // "3:30-5pm": the start shares the end's am/pm.
    const start = minutes(m[2], m[3], m[4] ?? endAp, true);
    let end = minutes(m[5], m[6], endAp, true);
    if (end <= start) end = start + 60;
    if (end - start > 8 * 60) continue;
    out.push({ weekday, start, end });
    if (out.length >= 6) break;
  }
  return out;
}

/** The windows on one weekday, as [start, end] minute blocks. */
export function avoidOn(windows: readonly AvoidWindow[] | undefined, weekday: number): [number, number][] {
  return (windows ?? []).filter((w) => w.weekday === weekday).map((w) => [w.start, w.end]);
}
