// The numbers behind a project's stats panel and the School card. Pure, no AI:
// everything comes from the tasks already on the calendar.
//
// "Done in the last 7 days" counts by completedAt. Tasks finished before that
// was recorded fall back to their date (a step finished long after its date
// doesn't count), and the pace says so with `approximate`.

import { splitCourse } from "./course";
import { estimateMinutes } from "./load";
import type { WeekStart } from "./month-grid";
import { endOfWeek } from "./task-filters";
import { addDaysYMD, daysBetweenYMD } from "./time";
import type { Task } from "./types";

export type StatTask = Pick<Task, "id" | "title" | "date" | "time" | "completed" | "source"> & Partial<Task>;

export type PaceStatus = "On track" | "Slightly behind" | "Behind";

export type Pace = {
  remaining: number;
  /** Days until the last open step, today included. Null with no dated steps. */
  daysLeft: number | null;
  /** Whole steps to finish in the next 7 days to stay on course (rounded up). */
  neededThisWeek: number;
  doneLast7: number;
  /** True when a finished step had no completedAt and was counted by its date. */
  approximate: boolean;
  overdue: number;
  status: PaceStatus;
  /** The first step's date while nothing is done and it's still ahead: the
   *  project hasn't started, so it's neither on track nor behind. */
  startsOn: string | null;
};

export type WeekLoad = { start: string; end: string; label: string; minutes: number; count: number };
export type Focus = { title: string; why: string; taskId?: string };
export type CourseGroup<T extends StatTask = StatTask> = { course: string; open: T[]; dueThisWeek: number; next: T | null };

/** Below this share of the needed pace, a student is Behind, not Slightly. */
const BEHIND_BELOW = 0.5;
/** How far ahead School's focus looks; further out can wait. */
const FOCUS_WINDOW_DAYS = 14;
const SESSION_LENGTHS = [30, 45, 60];
const MAX_SESSIONS_A_WEEK = 5;

const byDate = (a: StatTask, b: StatTask) =>
  // Undated steps last.
  (a.date || "9999").localeCompare(b.date || "9999") || (a.time ?? "").localeCompare(b.time ?? "");

function openSteps<T extends StatTask>(tasks: T[]): T[] {
  return tasks.filter((t) => !t.completed).sort(byDate);
}

export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function progressOf(tasks: StatTask[]): { done: number; total: number; percent: number } {
  const done = tasks.filter((t) => t.completed).length;
  return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function paceOf(tasks: StatTask[], today: string): Pace {
  const open = openSteps(tasks);
  const dated = open.filter((t) => t.date);
  const last = dated[dated.length - 1]?.date;
  const daysLeft = last ? Math.max(1, daysBetweenYMD(today, last) + 1) : null;
  // Whole steps: 8 steps over 37 days is 2 this week, never "1.5135… steps".
  // The epsilon keeps an exact 2 from rounding up to 3.
  const neededThisWeek = daysLeft === null ? 0 : Math.ceil((open.length * Math.min(7, daysLeft)) / daysLeft - 1e-9);
  const weekAgo = addDaysYMD(today, -6);
  let approximate = false;
  const doneLast7 = tasks.filter((t) => {
    if (!t.completed) return false;
    // completedAt is UTC; its calendar date is close enough for a weekly count.
    if (t.completedAt) return t.completedAt.slice(0, 10) >= weekAgo;
    if (t.date >= weekAgo) approximate = true;
    return t.date >= weekAgo;
  }).length;
  const overdue = dated.filter((t) => t.date < today).length;
  // Round 4 §3.6: a step dated today isn't missed until today is over, so a
  // plan made this morning never opens on "Behind: 0 steps done".
  const wasDue = tasks.some((t) => t.date && t.date >= weekAgo && t.date < today);

  let status: PaceStatus = "On track";
  // Nothing has come due yet: a brand-new plan isn't behind for having no
  // finished steps.
  if (open.length > 0 && (overdue > 0 || wasDue) && doneLast7 < neededThisWeek) {
    status = doneLast7 / neededThisWeek >= BEHIND_BELOW ? "Slightly behind" : "Behind";
  }
  const first = dated[0]?.date;
  const startsOn = first && first >= today && overdue === 0 && !tasks.some((t) => t.completed) ? first : null;
  return { remaining: open.length, daysLeft, neededThisWeek, doneLast7, approximate, overdue, status, startsOn };
}

/** "Starts today", "Starts tomorrow", "Starts Tue, Nov 10". */
export function startsLabel(startsOn: string, today: string): string {
  if (startsOn === today) return "Starts today";
  if (startsOn === addDaysYMD(today, 1)) return "Starts tomorrow";
  return `Starts ${weekdayDate(startsOn)}`;
}

/** Round 4 §3.6: workload in whole or half hours, never "4.7 hrs" or
 *  "283 min": "about 30 min", "about 1 hr", "about 2.5 hrs". */
export function hoursLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "nothing planned";
  if (minutes < 45) return `about ${Math.max(15, Math.round(minutes / 15) * 15)} min`;
  const half = Math.max(1, Math.round(minutes / 30) / 2);
  return `about ${half} hr${half === 1 ? "" : "s"}`;
}

export function nextSteps<T extends StatTask>(tasks: T[], count = 3): T[] {
  return openSteps(tasks).slice(0, count);
}

/** The next date that matters: the soonest one ahead, or else the oldest missed. */
export function nextDeadline<T extends StatTask>(tasks: T[], today: string): T | null {
  const dated = openSteps(tasks).filter((t) => t.date);
  return dated.find((t) => t.date >= today) ?? dated[0] ?? null;
}

/** Minutes to do in the next 7 days, spread evenly up to the last open step. */
function minutesThisWeek(tasks: StatTask[], today: string): number {
  const open = openSteps(tasks);
  const total = open.reduce((sum, t) => sum + estimateMinutes(t as Task), 0);
  const { daysLeft } = paceOf(tasks, today);
  return daysLeft === null ? Math.min(total, 180) : (total * Math.min(7, daysLeft)) / daysLeft;
}

export function recommendedPace(tasks: StatTask[], today: string): string {
  if (openSteps(tasks).length === 0) return "Nothing left to do here.";
  const minutes = minutesThisWeek(tasks, today);
  const length = SESSION_LENGTHS.find((l) => minutes / l <= MAX_SESSIONS_A_WEEK) ?? SESSION_LENGTHS[SESSION_LENGTHS.length - 1];
  const sessions = Math.max(1, Math.round(minutes / length));
  return `About ${sessions} session${sessions === 1 ? "" : "s"} of ${length} min this week keeps you on track.`;
}

export type StepWeeks<T extends StatTask = StatTask> = { thisWeek: T[]; nextWeek: T[]; later: T[] };

/** Open steps as This week (overdue included), Next week and Later (undated last). */
export function stepsByWeek<T extends StatTask>(tasks: T[], today: string, weekStart?: WeekStart): StepWeeks<T> {
  const thisEnd = endOfWeek(today, weekStart);
  const nextEnd = addDaysYMD(thisEnd, 7);
  const out: StepWeeks<T> = { thisWeek: [], nextWeek: [], later: [] };
  for (const t of openSteps(tasks)) {
    if (t.date && t.date <= thisEnd) out.thisWeek.push(t);
    else if (t.date && t.date <= nextEnd) out.nextWeek.push(t);
    else out.later.push(t);
  }
  return out;
}

export type WeekSession = "done" | "planned" | "missed";

/** One dot per step dated this week, in order: done, missed (its day passed)
 *  or planned. Steps finished this week from another week don't add dots. */
export function weekSessions(tasks: StatTask[], today: string, weekStart?: WeekStart): WeekSession[] {
  const end = endOfWeek(today, weekStart);
  const start = addDaysYMD(end, -6);
  return tasks
    .filter((t) => t.date && t.date >= start && t.date <= end)
    .sort(byDate)
    .map((t) => (t.completed ? "done" : t.date < today ? "missed" : "planned"));
}

/** "Tue, Nov 17" */
export function weekdayDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** The first week starts today and includes unfinished work from earlier days. */
export function workloadByWeek(tasks: StatTask[], today: string, weeks = 4, weekStart?: WeekStart): WeekLoad[] {
  const open = tasks.filter((t) => !t.completed && t.date);
  const out: WeekLoad[] = [];
  let start = today;
  let end = endOfWeek(today, weekStart);
  for (let i = 0; i < weeks; i++) {
    const from = start;
    const to = end;
    const inWeek = open.filter((t) => (i === 0 ? t.date <= to : t.date >= from && t.date <= to));
    out.push({
      start: from,
      end: to,
      label: i === 0 ? "This week" : i === 1 ? "Next week" : shortDate(from),
      minutes: inWeek.reduce((sum, t) => sum + estimateMinutes(t as Task), 0),
      count: inWeek.length,
    });
    start = addDaysYMD(end, 1);
    end = addDaysYMD(end, 7);
  }
  return out;
}

/** A project's bottleneck: its most overdue step, or else the biggest one
 *  coming up in the next two weeks. */
export function bottleneckStep(tasks: StatTask[], today: string): Focus | null {
  const open = openSteps(tasks);
  if (open.length === 0) return null;
  const late = open.find((t) => t.date && t.date < today);
  if (late) return { title: late.title, why: `It was due ${shortDate(late.date)} and the steps after it are waiting.`, taskId: late.id };
  const horizon = addDaysYMD(today, FOCUS_WINDOW_DAYS);
  const soon = open.filter((t) => t.date && t.date <= horizon);
  const biggest = [...(soon.length ? soon : open)].sort((a, b) => estimateMinutes(b as Task) - estimateMinutes(a as Task) || byDate(a, b))[0];
  return { title: biggest.title, why: biggest.date ? `It's the biggest step coming up, on ${shortDate(biggest.date)}.` : "It's the biggest step left.", taskId: biggest.id };
}

/** How much one assignment pulls on a course: the nearer it's due, the more,
 *  scaled by how long it takes. Overdue pulls as hard as due today. */
export function assignmentWeight(minutes: number, daysUntil: number): number {
  return (minutes / 60) / (1 + Math.max(0, daysUntil));
}

export function courseGroups<T extends StatTask>(tasks: T[], today: string): CourseGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const t of tasks) {
    const course = splitCourse(t).course ?? "Other";
    groups.set(course, [...(groups.get(course) ?? []), t]);
  }
  const weekEnd = endOfWeek(today);
  return Array.from(groups.entries())
    .map(([course, list]) => {
      const open = openSteps(list);
      return { course, open, dueThisWeek: open.filter((t) => t.date && t.date <= weekEnd).length, next: nextDeadline(list, today) };
    })
    .filter((g) => g.open.length > 0)
    .sort((a, b) => (a.next?.date || "9999").localeCompare(b.next?.date || "9999") || a.course.localeCompare(b.course));
}

/** Which course to work on first, and the assignment that says why. */
export function schoolFocus(tasks: StatTask[], today: string): Focus | null {
  const horizon = addDaysYMD(today, FOCUS_WINDOW_DAYS);
  let best: { course: string; score: number; top: StatTask; count: number } | null = null;
  for (const group of courseGroups(tasks, today)) {
    const near = group.open.filter((t) => t.date && t.date <= horizon);
    if (near.length === 0) continue;
    const score = near.reduce((sum, t) => sum + assignmentWeight(estimateMinutes(t as Task), daysBetweenYMD(today, t.date)), 0);
    if (!best || score > best.score) best = { course: group.course, score, top: near[0], count: near.length };
  }
  if (!best) return null;
  const topic = splitCourse(best.top).title;
  return {
    title: best.course === "Other" ? topic : `${best.course}: ${topic}`,
    why: `${best.count} due in the next two weeks, the nearest on ${shortDate(best.top.date)}.`,
    taskId: best.top.id,
  };
}

export function dueThisWeek(tasks: StatTask[], today: string): number {
  const weekEnd = endOfWeek(today);
  return tasks.filter((t) => !t.completed && t.date && t.date <= weekEnd).length;
}
