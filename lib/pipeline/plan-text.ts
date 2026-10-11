// Pipeline V2: reads the schedule a chat reply already showed the student
// ("Day, date — time — what", one session per line) into tasks, so "Add to
// calendar" saves exactly what was on screen instead of asking the AI again.
//
// Never drops a line silently: every schedule-like line is either read into a
// task or returned in `skipped`, and the card says "Read X of Y lines".
//
// Pure (no store, no AI) so it can be unit tested with plain Node.

import type { DraftTask } from "./draft";

export type PlanTextResult = {
  /** One task per line that was read, in reply order. */
  tasks: DraftTask[];
  /** Schedule-like lines found (read + skipped). */
  total: number;
  /** Schedule-like lines that could not be read, as they appeared. */
  skipped: string[];
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const WEEKDAY_RE = /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?\b\.?/i;
const MONTH_DAY_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
const DAY_MONTH_RE = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i;
const NUMERIC_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const RELATIVE_RE = /^(today|tonight|tomorrow)\b/i;

// A line that starts like a schedule entry: a day, then a separator.
const BULLET_RE = /^\s*(?:[-*•·]|\d{1,2}[.)])\s+/;
const WEEKDAY_WORD = String.raw`(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?\.?`;
const MONTH_WORD = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const STARTS_WITH_DAY = new RegExp(
  String.raw`^(?:${WEEKDAY_WORD}(?=[\s,:—–|-]|$)|${MONTH_WORD}\s+\d|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|today\b|tonight\b|tomorrow\b)`,
  "i"
);
// Em or en dash with any spacing, a spaced hyphen, or a pipe. With none of
// those, the first ": " ("Mon: Outline essay").
const SEPARATOR = /\s*[—–|]\s*|\s+-\s+/;

const TIME_RE = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?:\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?)?/i;
const ANY_TIME_RE =
  /^\s*(?:\d{1,2}(?::\d{2})?\s*(?:(?:-|to)\s*\d{1,2}(?::\d{2})?\s*)?(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2}|noon|midnight)/i;

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (s: string) => new Date(`${s}T12:00:00Z`);
const monthIndex = (m: string) => MONTHS.findIndex((name) => name.startsWith(m.toLowerCase().slice(0, 3)));

/** A real calendar date, or null ("Feb 30"). */
function makeDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m, d, 12));
  return dt.getUTCMonth() === m && dt.getUTCDate() === d ? ymd(dt) : null;
}

/** A month and day with no year: the year that puts it nearest after today.
 *  Up to a week in the past stays this year ("Mon" of a plan already started). */
function withYear(m: number, d: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = makeDate(year, m, d);
  if (thisYear && utc(thisYear).getTime() >= utc(today).getTime() - 7 * DAY_MS) return thisYear;
  return makeDate(year + 1, m, d) ?? thisYear;
}

/** The date a day label names ("Mon, Oct 12", "10/12", "Thursday", "Tomorrow"), or null. */
export function parseDayLabel(label: string, today: string): string | null {
  const s = label.trim();
  const rel = s.match(RELATIVE_RE);
  if (rel) return ymd(new Date(utc(today).getTime() + (rel[1].toLowerCase() === "tomorrow" ? DAY_MS : 0)));
  const iso = s.match(ISO_RE);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const md = s.match(MONTH_DAY_RE);
  if (md) return withYear(monthIndex(md[1]), Number(md[2]), today);
  const dm = s.match(DAY_MONTH_RE);
  if (dm) return withYear(monthIndex(dm[2]), Number(dm[1]), today);
  const num = s.match(NUMERIC_RE);
  if (num) {
    const [m, d] = [Number(num[1]) - 1, Number(num[2])];
    if (num[3]) return makeDate(num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]), m, d);
    return withYear(m, d, today);
  }
  const wd = s.match(WEEKDAY_RE);
  if (wd) {
    const target = WEEKDAYS.findIndex((w) => w.startsWith(wd[1].toLowerCase().slice(0, 3)));
    const from = utc(today);
    const ahead = (target - from.getUTCDay() + 7) % 7;
    return ymd(new Date(from.getTime() + ahead * DAY_MS));
  }
  return null;
}

/** "HH:MM" for the start of a time or range ("4:00 PM", "4-5pm", "16:00",
 *  "noon"), or null. With no AM/PM anywhere, 1 to 6 reads as afternoon. */
export function parseTimeLabel(label: string): string | null {
  const s = label.trim().toLowerCase();
  if (/^noon\b/.test(s)) return "12:00";
  if (/^midnight\b/.test(s)) return "00:00";
  const m = s.match(TIME_RE);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = (m[3] ?? m[6] ?? "").replace(/\./g, "");
  if (!m[2] && !mer) return null; // a bare number ("3") is not a time
  if (min > 59 || h > 23) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "pm" && h !== 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    // "11-1pm": the range ends after noon, the start is still morning.
    if (!m[3] && m[6] && m[4] && Number(m[4]) < Number(m[1]) && mer === "pm") h -= 12;
  } else if (h >= 1 && h <= 6) {
    h += 12;
  }
  return `${pad(h)}:${pad(min)}`;
}

/** A line's parts between separators. A colon later in the title stays. */
function splitParts(s: string): string[] {
  if (SEPARATOR.test(s)) return s.split(SEPARATOR);
  const i = s.search(/:\s+/);
  return i === -1 ? [s] : [s.slice(0, i), s.slice(i).replace(/^:\s+/, "")];
}

/** The line without a list bullet or markdown emphasis. */
function clean(line: string): string {
  return line.replace(BULLET_RE, "").replace(/\*\*|__/g, "").trim();
}

/** True when a line looks like one schedule entry ("Mon, Oct 12 — …"). */
export function isScheduleLine(line: string): boolean {
  const s = clean(line);
  if (!STARTS_WITH_DAY.test(s)) return false;
  const day = splitParts(s)[0];
  return day.length < s.length && day.length <= 40;
}

/** How many schedule-like lines a reply has: shows "Add to calendar" when > 0. */
export function countScheduleLines(text: string): number {
  return text.split(/\r?\n/).filter(isScheduleLine).length;
}

/**
 * A finished schedule, ready to add: at least two entries and not waiting on
 * an answer (the last line isn't a question). Pipeline V2 only offers "Ready
 * to add this to your calendar?" for these.
 */
export function isCompleteSchedule(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  return countScheduleLines(text) >= 2 && !last.endsWith("?");
}

/** One entry, or null when it can't be read. */
function parseLine(line: string, today: string): DraftTask | null {
  // "4–5pm" and "4:00 PM – 5:00 PM" are one time, not two parts. A spaced dash
  // after a plain number ("Oct 26 — 4:00 PM") still separates.
  const text = clean(line)
    .replace(/(\d)[–—](\d)/g, "$1-$2")
    .replace(/(\d:\d{2}|[ap]\.?m\.?)\s*[–—]\s*(\d)/gi, "$1-$2");
  const parts = splitParts(text)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const date = parseDayLabel(parts[0], today);
  if (!date) return null;

  let rest = parts.slice(1);
  let time = "";
  // "11/01 - 3 - Review": a bare number could be a time or part of the title.
  // Ambiguous, so the line is skipped and listed rather than guessed.
  if (rest.length >= 2 && /^\d{1,2}$/.test(rest[0])) return null;
  if (rest.length >= 2 && ANY_TIME_RE.test(rest[0])) {
    const t = parseTimeLabel(rest[0]);
    if (!t) return null;
    time = t;
    rest = rest.slice(1);
    // "4 PM – 5 PM — Outline": the range's end split off as its own part.
    if (rest.length >= 2 && ANY_TIME_RE.test(rest[0]) && rest[0].replace(ANY_TIME_RE, "").trim() === "") rest = rest.slice(1);
  } else if (rest.length === 1) {
    // "Mon, Oct 12, 4 PM — Outline" or "Mon 4pm: Outline": a time inside the day part.
    const inDay = parts[0].match(/(?:,|\bat\b|\s)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)(?:\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)?)\s*$/i);
    if (inDay) time = parseTimeLabel(inDay[1]) ?? "";
  }
  const title = rest.join(" — ").replace(/\s+/g, " ").trim();
  if (!title || title.length > 200) return null;
  return { title, date, time };
}

/**
 * Every schedule line in a reply, read into tasks. `today` is the student's
 * local date (YYYY-MM-DD), used for the year and for weekday-only lines.
 */
export function parsePlanText(text: string, today: string): PlanTextResult {
  const tasks: DraftTask[] = [];
  const skipped: string[] = [];
  let total = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!isScheduleLine(raw)) continue;
    total++;
    const task = parseLine(raw, today);
    if (task) tasks.push(task);
    else skipped.push(clean(raw));
  }
  return { tasks, total, skipped };
}

/** The card's notes for lines that weren't read: "Read 5 of 7 lines" and each
 *  skipped line. Empty when every line was read. Fits the ChangeSet's 10
 *  assumptions of 200 characters. */
export function skippedNotes(r: Pick<PlanTextResult, "tasks" | "total" | "skipped">): string[] {
  if (r.skipped.length === 0) return [];
  const clip = (s: string) => (s.length > 180 ? s.slice(0, 179).trimEnd() + "…" : s);
  const shown = r.skipped.length > 9 ? r.skipped.slice(0, 8) : r.skipped;
  const notes = [`Read ${r.tasks.length} of ${r.total} lines`, ...shown.map((s) => `Skipped: ${clip(s)}`)];
  if (shown.length < r.skipped.length) notes.push(`Skipped ${r.skipped.length - shown.length} more lines`);
  return notes;
}

/** The plan prompt's closing line about switching modes. With one box there
 *  is no switch, so it is cut from the reply (the prompt itself is unchanged). */
export function stripModeSwitchLine(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !/switch to calendar/i.test(l))
    .join("\n")
    .trim();
}

/** "add this plan", "put that on my calendar", "add it": a request to add the
 *  plan the assistant just showed. */
export function isAddShownPlan(text: string): boolean {
  const s = text.trim().toLowerCase().replace(/[.!?]+$/, "");
  return (
    /\b(?:add|put|save|schedule)\b.*\b(?:this|that|the|it|these|those)\b.*\b(?:plan|schedule|calendar|sessions?)\b/.test(s) ||
    /^(?:please\s+)?(?:add|put|save)\s+(?:it|this|that|them|these|those)(?:\s+(?:in|on|to)\s+(?:my\s+)?calendar)?$/.test(s) ||
    /^(?:yes|yeah|yep|sure|ok(?:ay)?)[, ]+(?:add|put|save)\b/.test(s)
  );
}
