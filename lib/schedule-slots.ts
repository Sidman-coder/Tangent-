// Open times for a Path's first step. Small and deterministic on purpose: no
// AI, no settings, no availability engine. It reads only what TANGENT already
// knows (the student's tasks and their School block) and proposes a few
// sensible times in the student's own timezone. The student always has "Pick
// a time" when these are wrong.

import type { SuggestedSlot, Task } from "./types";
import { addDaysYMD, weekdayOf } from "./time";

/** Tasks have no duration; like the week view, a step is drawn as 45 minutes. */
export const STEP_BLOCK_MIN = 45;
/** A School block with no "Until" note is assumed to last this long. */
const SCHOOL_FALLBACK_MIN = 7 * 60;
/** Nothing sooner than this from now: time to actually get to it. */
const LEAD_MIN = 60;
/** Today plus this many days. */
const HORIZON_DAYS = 7;
const STEP_MIN = 30;

const WEEKDAY_EARLIEST = 15 * 60 + 30; // 3:30 PM
const WEEKDAY_LATEST_END = 20 * 60 + 30; // 8:30 PM
const AFTER_SCHOOL_GAP = 30;
const WEEKEND_WINDOWS: Array<[number, number]> = [
  [9 * 60 + 30, 12 * 60], // morning
  [14 * 60, 20 * 60], // afternoon and early evening
];

type Block = [number, number];

/** "HH:MM" (24-hour) to minutes since midnight; null for anything else,
 *  including the empty time an all-day task has. */
export function toMinutes(time: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Onboarding writes a School block's end as "Until 3:00 PM" in its notes. */
export function schoolEndFromNotes(notes: string | undefined): number | null {
  const m = /until\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\b/i.exec(notes ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return ((h % 12) + (m[3].toLowerCase() === "p" ? 12 : 0)) * 60 + min;
}

/** The recurring School block from onboarding, not any task tagged "school"
 *  (a test or a Canvas assignment is a moment, not the whole day). */
function isSchoolBlock(t: Task): boolean {
  if (t.kind !== "school" || t.source === "canvas") return false;
  return schoolEndFromNotes(t.notes) !== null || t.title.trim().toLowerCase() === "school";
}

function dayBusy(tasks: Task[], date: string): { busy: Block[]; schoolEnd: number | null } {
  const busy: Block[] = [];
  let schoolEnd: number | null = null;
  for (const t of tasks) {
    // Canvas items are deadlines, not time the student is occupied.
    if (t.date !== date || t.source === "canvas") continue;
    const start = toMinutes(t.time);
    if (start === null) continue;
    if (isSchoolBlock(t)) {
      const parsed = schoolEndFromNotes(t.notes);
      const end = parsed !== null && parsed > start ? parsed : start + SCHOOL_FALLBACK_MIN;
      busy.push([start, end]);
      schoolEnd = Math.max(schoolEnd ?? 0, end);
    } else if (!t.completed) {
      busy.push([start, start + STEP_BLOCK_MIN]);
    }
  }
  return { busy, schoolEnd };
}

function isWeekend(date: string): boolean {
  const wd = weekdayOf(date);
  return wd === 0 || wd === 6;
}

function dayWindows(date: string, schoolEnd: number | null): Block[] {
  if (isWeekend(date)) return WEEKEND_WINDOWS;
  const start = Math.max(WEEKDAY_EARLIEST, schoolEnd !== null ? schoolEnd + AFTER_SCHOOL_GAP : 0);
  return [[start, WEEKDAY_LATEST_END]];
}

function firstFree(windows: Block[], busy: Block[], earliest: number): number | null {
  for (const [from, to] of windows) {
    let s = Math.ceil(Math.max(from, earliest) / STEP_MIN) * STEP_MIN;
    for (; s + STEP_BLOCK_MIN <= to; s += STEP_MIN) {
      const e = s + STEP_BLOCK_MIN;
      if (!busy.some(([b0, b1]) => s < b1 && b0 < e)) return s;
    }
  }
  return null;
}

/**
 * Up to `count` open times over the next week: the first free slot on each
 * day, earliest days first, on different days. If none of those falls on a
 * weekend, the last is swapped for a weekend morning when one is free, so the
 * student sees one unhurried option.
 *
 * `now` is the student's local date and minutes since midnight (localNow).
 */
export function suggestSlots(
  tasks: Task[],
  now: { date: string; minutes: number },
  count = 3
): SuggestedSlot[] {
  type Candidate = SuggestedSlot & { weekendMorning: boolean };
  const candidates: Candidate[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const date = addDaysYMD(now.date, i);
    const { busy, schoolEnd } = dayBusy(tasks, date);
    const start = firstFree(dayWindows(date, schoolEnd), busy, i === 0 ? now.minutes + LEAD_MIN : 0);
    if (start === null) continue;
    const weekend = isWeekend(date);
    candidates.push({
      date,
      time: hhmm(start),
      afterSchool: !weekend && schoolEnd !== null,
      weekendMorning: weekend && start < WEEKEND_WINDOWS[0][1],
    });
  }

  const picked = candidates.slice(0, count);
  if (picked.length === count && !picked.some((c) => isWeekend(c.date))) {
    const morning = candidates.find((c) => c.weekendMorning);
    if (morning) picked[count - 1] = morning;
  }
  return picked
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .map(({ date, time, afterSchool }) => ({ date, time, afterSchool }));
}

/** True when date/time is before `now` (student's local wall clock). */
export function isBeforeNow(date: string, time: string, now: { date: string; minutes: number }): boolean {
  if (date !== now.date) return date < now.date;
  const m = toMinutes(time);
  return m === null || m < now.minutes;
}
