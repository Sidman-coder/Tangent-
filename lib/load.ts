// The spacing brain. Decides where new work goes so a week doesn't pile up on
// one night, and spots a day that is already too full.
//
// Deterministic and AI-free on purpose: the model decides WHAT a task is; this
// decides WHEN, from what TANGENT already knows — the student's tasks, their
// School block, and how much they can take on in a day (their capacity).
// Tasks have no duration field, so each one's size is estimated (TIME: line in
// its notes when the AI wrote one, otherwise by what kind of thing it is).

import { firstOpenTime, isSchoolBlock } from "./schedule-slots";
import { addDaysYMD, daysBetweenYMD, weekdayOf, WEEKDAY_NAMES } from "./time";
import type { Task } from "./types";

/** Minutes of work a student can take on in a day before it's too much. */
export type Capacity = { weekday: number; weekend: number };

/** Used until the student says otherwise: a school night is about two and a
 *  half hours of real work, a weekend day about four. */
export const DEFAULT_CAPACITY: Capacity = { weekday: 150, weekend: 240 };

/** Default size of a new piece of work when nothing better is known. */
export const DEFAULT_TASK_MIN = 45;

/** How far ahead the brain looks when the student gave no deadline. */
export const DEFAULT_HORIZON_DAYS = 6;

/** Not sooner than this from now on today: time to actually get to it. */
const LEAD_MIN = 60;

/** Minutes from a "TIME: 45 mins total — …" or "TIME: 1.5 hours" notes line. */
export function minutesFromNotes(notes: string | undefined): number | null {
  const line = /(?:^|\n)\s*TIME:\s*([^\n]*)/i.exec(notes ?? "")?.[1];
  if (!line) return null;
  const m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i.exec(line);
  if (!m) return null;
  const n = Number(m[1]);
  const minutes = /^h/i.test(m[2]) ? n * 60 : n;
  return Math.min(240, Math.max(10, Math.round(minutes)));
}

/** How many minutes a task takes out of its day. Done tasks and the School
 *  block (school itself isn't homework) count for nothing. */
export function estimateMinutes(t: Task): number {
  if (t.completed || isSchoolBlock(t)) return 0;
  const fromNotes = minutesFromNotes(t.notes);
  if (fromNotes !== null) return fromNotes;
  // Practices, rehearsals, club meetings: real time out of the evening.
  if (t.kind === "commitment" || t.recurring?.enabled) return 90;
  return DEFAULT_TASK_MIN;
}

export function isWeekendDate(date: string): boolean {
  const wd = weekdayOf(date);
  return wd === 0 || wd === 6;
}

export function capacityOn(date: string, cap: Capacity): number {
  return isWeekendDate(date) ? cap.weekend : cap.weekday;
}

export function dayLoad(tasks: Task[], date: string): number {
  let sum = 0;
  for (const t of tasks) if (t.date === date) sum += estimateMinutes(t);
  return sum;
}

export type DayLoad = { date: string; minutes: number; capacity: number };

export function loadByDay(tasks: Task[], from: string, days: number, cap: Capacity): DayLoad[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysYMD(from, i);
    return { date, minutes: dayLoad(tasks, date), capacity: capacityOn(date, cap) };
  });
}

/** "45 min", "2 hrs", "2.5 hrs". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.round((min / 60) * 2) / 2;
  return `${h % 1 === 0 ? h.toFixed(0) : h.toFixed(1)} hr${h === 1 ? "" : "s"}`;
}

export function dayName(date: string): string {
  return WEEKDAY_NAMES[weekdayOf(date)];
}

function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

type Now = { date: string; minutes: number };

export type Placement = {
  date: string;
  time: string;
  /** One plain sentence when the brain moved off the day that was asked for. */
  note?: string;
};

/**
 * Where a new piece of work should go: the lightest day between `earliest`
 * and `latest` that still has room, leaning a little toward sooner so work
 * isn't pushed against the deadline. `preferredDate` (what the student or the
 * model asked for) wins whenever it fits. Returns null only when no day in
 * range has an open time at all.
 */
export function placeTask(
  tasks: Task[],
  opts: {
    now: Now;
    minutes?: number;
    cap: Capacity;
    earliest?: string;
    latest?: string;
    preferredDate?: string;
  }
): Placement | null {
  const minutes = opts.minutes ?? DEFAULT_TASK_MIN;
  const earliest = opts.earliest && opts.earliest > opts.now.date ? opts.earliest : opts.now.date;
  const latest =
    opts.latest && opts.latest >= earliest ? opts.latest : addDaysYMD(earliest, DEFAULT_HORIZON_DAYS);
  const span = daysBetweenYMD(earliest, latest) + 1;

  const candidates = loadByDay(tasks, earliest, span, opts.cap).map((d, i) => {
    const after = d.minutes + minutes;
    return {
      ...d,
      fits: after <= d.capacity,
      // Fullness after adding it, plus a small nudge toward sooner.
      score: after / d.capacity + (0.25 * i) / Math.max(1, span),
    };
  });

  const timeOn = (date: string) =>
    firstOpenTime(tasks, date, date === opts.now.date ? opts.now.minutes + LEAD_MIN : 0, minutes);

  const preferred = opts.preferredDate ? candidates.find((c) => c.date === opts.preferredDate) : undefined;
  if (preferred?.fits) {
    const time = timeOn(preferred.date);
    if (time) return { date: preferred.date, time };
  }

  const ranked = [...candidates].sort((a, b) => Number(b.fits) - Number(a.fits) || a.score - b.score);
  for (const c of ranked) {
    const time = timeOn(c.date);
    if (!time) continue;
    let note: string | undefined;
    if (preferred && preferred.date !== c.date) {
      note = `${dayName(preferred.date)} already has about ${formatMinutes(preferred.minutes)} planned, so I put it on ${dayName(c.date)}.`;
    } else if (!c.fits) {
      note = `Heads up: every day in range is already full, so ${dayName(c.date)} is now over your usual load.`;
    }
    return { date: c.date, time, note };
  }
  return null;
}

/**
 * Session dates for a multi-session plan, spread around the load that's
 * already there. Each session stays near its evenly spaced date (within
 * `slack` days either side, never before the previous session) and moves to
 * the lighter day. Sessions placed earlier count toward later days' load.
 */
export function spreadSessions(
  tasks: Task[],
  dates: string[],
  opts: { now: Now; minutes?: number; cap: Capacity; slack?: number }
): { date: string; time: string }[] {
  const minutes = opts.minutes ?? DEFAULT_TASK_MIN;
  const slack = opts.slack ?? 1;
  const working = [...tasks];
  const out: { date: string; time: string }[] = [];
  let floor = opts.now.date;
  for (const target of dates) {
    const earliest = [addDaysYMD(target, -slack), floor].sort().pop()!;
    const latest = [addDaysYMD(target, slack), earliest].sort().pop()!;
    const placed = placeTask(working, { now: opts.now, minutes, cap: opts.cap, earliest, latest, preferredDate: target });
    const date = placed?.date ?? (target < floor ? floor : target);
    const time = placed?.time ?? "16:00";
    out.push({ date, time });
    working.push({ id: `pending-${out.length}`, title: "", date, time, completed: false, notes: `TIME: ${minutes} min` });
    floor = addDaysYMD(date, 1);
  }
  return out;
}

/** Work that can be moved to make room: not a deadline (Canvas), not a fixed
 *  commitment or repeating block, not done. */
function isMovable(t: Task): boolean {
  return (
    !t.completed &&
    t.source !== "canvas" &&
    !t.recurring?.enabled &&
    t.kind !== "commitment" &&
    t.kind !== "school" &&
    !isSchoolBlock(t)
  );
}

export type ReliefSuggestion = {
  taskId: string;
  title: string;
  fromDate: string;
  toDate: string;
  toTime: string;
  message: string;
};

/**
 * The first overloaded day in the next `days`, and one movable task on it
 * that fits on a lighter day within three days either side (never in the
 * past). Null when no day is over capacity or nothing can move.
 */
export function suggestRelief(tasks: Task[], opts: { now: Now; cap: Capacity; days?: number }): ReliefSuggestion | null {
  const days = opts.days ?? 7;
  for (const day of loadByDay(tasks, opts.now.date, days, opts.cap)) {
    if (day.minutes <= day.capacity) continue;
    const movable = tasks
      .filter((t) => t.date === day.date && isMovable(t))
      .sort((a, b) => Number(Boolean(b.planId)) - Number(Boolean(a.planId)) || estimateMinutes(b) - estimateMinutes(a));
    for (const task of movable) {
      const minutes = estimateMinutes(task);
      const others = tasks.filter((t) => t.id !== task.id);
      const earliest = [addDaysYMD(day.date, -3), opts.now.date].sort().pop()!;
      const placed = placeTask(others, {
        now: opts.now,
        minutes,
        cap: opts.cap,
        earliest,
        latest: addDaysYMD(day.date, 3),
      });
      if (!placed || placed.date === day.date) continue;
      if (dayLoad(others, placed.date) + minutes > capacityOn(placed.date, opts.cap)) continue;
      return {
        taskId: task.id,
        title: task.title,
        fromDate: day.date,
        toDate: placed.date,
        toTime: placed.time,
        message: `${dayName(day.date)} has about ${formatMinutes(day.minutes)} planned. Move "${task.title}" to ${dayName(placed.date)} at ${formatClock(placed.time)}?`,
      };
    }
  }
  return null;
}

/** The next `days` as short lines for an AI prompt, marking heavy days. */
export function describeLoad(tasks: Task[], from: string, days: number, cap: Capacity): string {
  return loadByDay(tasks, from, days, cap)
    .map((d) => {
      const ratio = d.minutes / d.capacity;
      const flag = ratio > 1 ? " — OVERLOADED" : ratio >= 0.8 ? " — heavy" : ratio <= 0.3 ? " — light" : "";
      return `${dayName(d.date).slice(0, 3)} ${d.date}: ${formatMinutes(d.minutes)} of ${formatMinutes(d.capacity)}${flag}`;
    })
    .join("\n");
}
