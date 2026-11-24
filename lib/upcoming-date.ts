// A month/day the student said with no year means the next one, never a past
// date (overnight 2: "AP Bio exam in May" said in November).
import { ymdFromParts } from "./time";

/** The next YYYY-MM-DD on or after `today` for this month (0-based) and day. */
export function upcomingYmd(today: string, monthIndex: number, day: number): string {
  const year = Number(today.slice(0, 4));
  const d = ymdFromParts(year, monthIndex, day);
  return d < today ? ymdFromParts(year + 1, monthIndex, day) : d;
}

const MONTH_WORD = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/g;
const MONTH_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ORDINAL: [string, number][] = [
  ["thirty first", 31], ["thirtieth", 30], ["twenty ninth", 29], ["twenty eighth", 28], ["twenty seventh", 27], ["twenty sixth", 26],
  ["twenty fifth", 25], ["twenty fourth", 24], ["twenty third", 23], ["twenty second", 22], ["twenty first", 21], ["twentieth", 20],
  ["nineteenth", 19], ["eighteenth", 18], ["seventeenth", 17], ["sixteenth", 16], ["fifteenth", 15], ["fourteenth", 14], ["thirteenth", 13],
  ["twelfth", 12], ["eleventh", 11], ["tenth", 10], ["ninth", 9], ["eighth", 8], ["seventh", 7], ["sixth", 6], ["fifth", 5],
  ["fourth", 4], ["third", 3], ["second", 2], ["first", 1],
];

/**
 * Every month the text names, with its day, in order. "Dec 17", "december
 * 17th", "17 Dec", "the seventeenth of december"; a month with no day is the
 * 1st ("in May"). Overnight 2 (Maya sim): only full month names were read,
 * so "Thu Dec 17" fell back to a one-week plan.
 */
export function findMonthDates(text: string): { month: number; day: number; position: number }[] {
  const s = text.toLowerCase();
  const out: { month: number; day: number; position: number }[] = [];
  for (const m of Array.from(s.matchAll(MONTH_WORD))) {
    const word = m[1];
    const at = m.index ?? 0;
    const after = s.slice(at + m[0].length, at + m[0].length + 16);
    const before = s.slice(Math.max(0, at - 24), at);
    // "may" is a verb too ("I may"): only count it with a day or after "in"/"by"/"of"/"until".
    const num = /^\s*(\d{1,2})(?:st|nd|rd|th)?\b/.exec(after) ?? /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?$/.exec(before);
    const ord = ORDINAL.find(([w]) => new RegExp(`\\b${w}\\b`).test(before + " " + after));
    if (word === "may" && !num && !ord && !/\b(in|by|of|until|till|before|early|mid|late|end of)\s+$/.test(before)) continue;
    const day = num ? Number(num[1]) : ord ? ord[1] : 1;
    if (day < 1 || day > 31) continue;
    out.push({ month: MONTH_INDEX[word.slice(0, 3)], day, position: at });
  }
  return out;
}

/** "from Dec 28 to Jan 4": the start is upcoming; the end follows it. */
export function upcomingRange(today: string, from: { month: number; day: number }, to: { month: number; day: number }): { start: string; end: string } {
  const start = upcomingYmd(today, from.month, from.day);
  const end = upcomingYmd(start, to.month, to.day);
  return { start, end };
}
