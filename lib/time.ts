// Calendar-day logic for a student's own timezone (profiles.timezone, IANA).
// A "day" is always a YYYY-MM-DD string; day arithmetic is pure calendar math
// on those strings, so neither DST nor the server's own zone can shift a date.
// Use these helpers — never `new Date().toISOString().slice(0, 10)` — whenever
// deciding what "today", "tomorrow" or "this week" means.

import { DEFAULT_TIMEZONE, isValidTimezone } from "./dates";

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** The current instant. Tests pin it with TANGENT_FAKE_NOW (only when NODE_ENV=test). */
export function currentInstant(): Date {
  const fake = process.env.NODE_ENV === "test" ? process.env.TANGENT_FAKE_NOW : undefined;
  return fake ? new Date(fake) : new Date();
}

function safeZone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-clock parts of `at` as seen in `tz`. */
function zonedParts(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute") };
}

/** YYYY-MM-DD for `ymd` shifted by whole calendar days. */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD day. */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenYMD(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** YYYY-MM-DD from calendar parts; out-of-range days roll over like Date does. */
export function ymdFromParts(year: number, monthIndex: number, day: number): string {
  const t = new Date(Date.UTC(year, monthIndex, day));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The student's local calendar day. */
export function getUserToday(tz: string, at: Date = currentInstant()): string {
  const p = zonedParts(tz, at);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export type LocalNow = {
  timeZone: string;
  date: string; // YYYY-MM-DD
  tomorrow: string;
  weekday: string; // "Friday"
  time: string; // "21:30"
  year: number;
  hour: number;
  minutes: number; // minutes since local midnight
};

/** Everything about "now" in the student's timezone. */
export function localNow(tz: string, at: Date = currentInstant()): LocalNow {
  const timeZone = safeZone(tz);
  const p = zonedParts(timeZone, at);
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return {
    timeZone,
    date,
    tomorrow: addDaysYMD(date, 1),
    weekday: WEEKDAY_NAMES[weekdayOf(date)],
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    year: p.year,
    hour: p.hour,
    minutes: p.hour * 60 + p.minute,
  };
}

/** One line for AI system prompts: the student's local date, weekday and time. */
export function promptDateContext(tz: string, at: Date = currentInstant()): string {
  const n = localNow(tz, at);
  return `The student's local date is ${n.weekday}, ${n.date}, and the local time is ${n.time} (${n.timeZone}). Tomorrow is ${WEEKDAY_NAMES[weekdayOf(n.tomorrow)]}, ${n.tomorrow}. Current year is ${n.year}. Resolve "today", "tonight", "tomorrow" and weekday names against this local date, never UTC.`;
}

/** Monday–Sunday week containing `ymd`. */
export function weekRange(ymd: string): { start: string; end: string } {
  const back = (weekdayOf(ymd) + 6) % 7; // days since Monday
  const start = addDaysYMD(ymd, -back);
  return { start, end: addDaysYMD(start, 6) };
}

// No bare "sun"/"sat": "study for the SAT" must not mean Saturday.
const WEEKDAY_PATTERN = "sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tues?|wed|thur?s?|fri";

function weekdayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(w);
}

/** Resolves the relative day a phrase refers to ("tomorrow", "tonight",
 *  "next friday", "in 3 days", "this weekend") in the student's timezone.
 *  Returns null when the text names no relative day. */
export function resolveRelativeDate(text: string, tz: string, at: Date = currentInstant()): string | null {
  const s = text.toLowerCase();
  const today = getUserToday(tz, at);

  if (/\bday after tomorrow\b/.test(s)) return addDaysYMD(today, 2);
  if (/\b(tomorrow|tmrw|tmr)\b/.test(s)) return addDaysYMD(today, 1);
  if (/\byesterday\b/.test(s)) return addDaysYMD(today, -1);
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(s)) return today;

  const inDays = s.match(/\bin (\d{1,3}|a|one|two|three|four|five|six|seven) days?\b/);
  if (inDays) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    const n = words[inDays[1]] ?? Number(inDays[1]);
    return addDaysYMD(today, n);
  }
  if (/\bnext week\b/.test(s)) return addDaysYMD(weekRange(today).start, 7);
  if (/\bthis weekend\b|\bweekend\b/.test(s)) {
    const wd = weekdayOf(today);
    return wd === 6 || wd === 0 ? today : addDaysYMD(today, 6 - wd);
  }

  const m = s.match(new RegExp(`\\b(next|this|on|by|coming)?\\s*(${WEEKDAY_PATTERN})\\b`));
  if (m) {
    const target = weekdayIndex(m[2]);
    if (target >= 0) {
      let ahead = (target - weekdayOf(today) + 7) % 7;
      // "next friday" on a Friday means a week out; a bare "friday" means today.
      if (ahead === 0 && m[1] === "next") ahead = 7;
      return addDaysYMD(today, ahead);
    }
  }
  return null;
}

const RELATIVE_DAY_WORDS = new RegExp(
  String.raw`\b(day after tomorrow|tomorrow|tmrw|tmr|yesterday|today|tonight|this (?:morning|afternoon|evening)|in \d{1,3} days?|next week|weekend|${WEEKDAY_PATTERN})\b`,
  "gi"
);
const EXPLICIT_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/i;

/** The one relative day a single-task capture names, or null when it names
 *  none, several, or also gives an explicit date. Used to keep the AI from
 *  putting "tomorrow" on the wrong day. ("tomorrow" and "day after tomorrow"
 *  count once.) */
export function singleRelativeDay(text: string, tz: string, at: Date = currentInstant()): string | null {
  if (EXPLICIT_DATE.test(text)) return null;
  const mentions = text.match(RELATIVE_DAY_WORDS) ?? [];
  if (mentions.length !== 1) return null;
  return resolveRelativeDate(text, tz, at);
}

export type Recurrence = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  daysOfWeek?: number[];
  endDate?: string;
  occurrences?: number;
};

/** The YYYY-MM-DD days a recurring task lands on, from `start` through
 *  `endDate` (default: 31 Dec of the start year), capped at `occurrences`
 *  (default 365). Pure calendar math, so DST never skips or repeats a day.
 *  Weekly with no days listed repeats on the start day's weekday. */
export function expandRecurrence(start: string, r: Recurrence): string[] {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const end = r.endDate && /^\d{4}-\d{2}-\d{2}$/.test(r.endDate) ? r.endDate : `${startYear}-12-31`;
  const max = r.occurrences ?? 365;
  const weekly = r.daysOfWeek && r.daysOfWeek.length > 0 ? r.daysOfWeek : [weekdayOf(start)];
  const dates: string[] = [];
  for (let d = start; d <= end && dates.length < max; d = addDaysYMD(d, 1)) {
    const [, m, day] = d.split("-").map(Number);
    const add =
      r.frequency === "daily" ||
      (r.frequency === "weekly" && weekly.includes(weekdayOf(d))) ||
      (r.frequency === "monthly" && day === startDay) ||
      (r.frequency === "yearly" && m === startMonth && day === startDay);
    if (add) dates.push(d);
  }
  return dates;
}

/** A Date whose *local* fields (getFullYear, getDate, getHours…) read as the
 *  student's wall clock in `tz`. For client code that does calendar math with
 *  local getters (dashboard, week-ahead, heatmap); never send it to the server
 *  or compare it with real instants such as created_at. */
export function wallClockNow(tz: string, at: Date = currentInstant()): Date {
  const p = zonedParts(tz, at);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, at.getSeconds());
}

/** The browser's own zone, used only until the profile has loaded. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Short zone label for a clock, e.g. "EDT" or "PST". */
export function zoneAbbreviation(tz: string, at: Date = currentInstant()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: safeZone(tz), timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? safeZone(tz);
}
