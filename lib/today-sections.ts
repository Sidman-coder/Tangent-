// What a student has on today, in the order the day happens. Home is built from
// this, so the answer to "what do I have to do?" lives in one tested place:
//   Past due   the last three days; Fresh start handles older work
//   Today      Morning / Afternoon / Evening / Night / Anytime, each grouped by
//              project, done items kept in place, with a Now line between rows
//   Coming up  the next three days
// Fixed items get strong overdue signals; flexible work gets a soft note and
// never turns red.

import { DEFAULT_TIMEZONE, formatTime12 } from "./dates";
import { isOnboardingSchoolTask } from "./school-block";
import { taskView } from "./task-filters";
import { commitmentOf, isCalendarImport } from "./task-kind";
import { addDaysYMD, getUserToday, localNow } from "./time";
import { tracksCompletion } from "./urgency";
import type { Task } from "./types";

/** Past due shows the last three days; anything older waits behind Fresh start. */
export const PAST_DUE_DAYS = 3;
export const COMING_UP_DAYS = 3;

export type DayPart = "morning" | "afternoon" | "evening" | "night" | "anytime";

/** The time-of-day groups, in order. `end` is the first minute after the group. */
export const DAY_PARTS: readonly { id: DayPart; label: string; range: string; end: number }[] = [
  { id: "morning", label: "Morning", range: "Before 12 PM", end: 12 * 60 },
  { id: "afternoon", label: "Afternoon", range: "12 – 5 PM", end: 17 * 60 },
  { id: "evening", label: "Evening", range: "5 – 9 PM", end: 21 * 60 },
  { id: "night", label: "Night", range: "After 9 PM", end: 24 * 60 },
  { id: "anytime", label: "Anytime today", range: "", end: Infinity },
];

/** Inside a time group, work sits under its project, "School" or "Personal". */
export type TaskGroupKind = "project" | "school" | "personal";
export type TaskBlock = { key: string; kind: TaskGroupKind; planId: string | null; tasks: Task[] };

export type DayGroup = { part: DayPart; tasks: Task[]; blocks: TaskBlock[]; open: number };

export type TodayGroups = {
  /** Open items from the last three days, newest first. */
  pastDue: Task[];
  /** Past due items older than that. */
  olderPastDueCount: number;
  /** Today's time groups that have anything in them, done items included. */
  parts: DayGroup[];
  counts: { left: number; must: number; pastDue: number; done: number };
  comingUp: { date: string; tasks: Task[] }[];
};

export type OverdueStyle = "hard" | "soft" | null;

function clockMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function dayPartOf(time: string): DayPart {
  const at = clockMinutes(time);
  if (at === null) return "anytime";
  return DAY_PARTS.find((p) => at < p.end)?.id ?? "night";
}

/** Timed first by time, then untimed; ties keep their order. */
function byTime(a: Task, b: Task): number {
  const x = clockMinutes(a.time);
  const y = clockMinutes(b.time);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
}

function newestFirst(a: Task, b: Task): number {
  if (a.date === b.date) return byTime(a, b);
  return a.date < b.date ? 1 : -1;
}

function blockOf(task: Task): Omit<TaskBlock, "tasks"> {
  if (task.planId) return { key: `plan:${task.planId}`, kind: "project", planId: task.planId };
  const view = taskView(task);
  if (view === "school") return { key: "school", kind: "school", planId: null };
  if (view === "projects") return { key: "path", kind: "project", planId: null };
  return { key: "personal", kind: "personal", planId: null };
}

/** Hard: a fixed or reminder item whose moment has passed. Soft: a flexible step
 *  from an earlier day. A past imported calendar event just happened, a recurring
 *  instance has its next one coming, and commitments aren't tracked, so none of
 *  those read as overdue. */
export function overdueStyle(task: Task, now: Date, tz: string = DEFAULT_TIMEZONE): OverdueStyle {
  if (task.completed || task.overdueDismissedAt || isOnboardingSchoolTask(task)) return null;
  if (!tracksCompletion(task)) return null;
  const today = getUserToday(tz, now);
  if (task.date > today) return null;
  const earlier = task.date < today;
  if (earlier && task.recurring) return null;

  if (commitmentOf(task) === "flexible") return earlier ? "soft" : null;
  if (isCalendarImport(task)) return null;
  if (earlier) return "hard";
  const at = clockMinutes(task.time);
  if (at === null) return null;
  return localNow(tz, now).minutes > at ? "hard" : null;
}

export function groupTodayTasks(tasks: Task[], now: Date, tz: string): TodayGroups {
  const today = getUserToday(tz, now);
  const firstPastDue = addDaysYMD(today, -PAST_DUE_DAYS);
  const last = addDaysYMD(today, COMING_UP_DAYS);

  const pastDue: Task[] = [];
  let older = 0;
  const onDay: Task[] = [];
  const upcoming = new Map<string, Task[]>();

  for (const task of tasks) {
    if (isOnboardingSchoolTask(task)) continue;
    if (task.date === today) {
      onDay.push(task);
      continue;
    }
    if (task.completed) continue;
    if (task.date < today) {
      if (!overdueStyle(task, now, tz)) continue;
      if (task.date >= firstPastDue) pastDue.push(task);
      else older += 1;
    } else if (task.date <= last) {
      const day = upcoming.get(task.date);
      if (day) day.push(task);
      else upcoming.set(task.date, [task]);
    }
  }

  onDay.sort(byTime);
  const parts: DayGroup[] = [];
  for (const { id } of DAY_PARTS) {
    const inPart = onDay.filter((t) => dayPartOf(t.time) === id);
    if (inPart.length === 0) continue;
    const blocks: TaskBlock[] = [];
    for (const task of inPart) {
      const b = blockOf(task);
      const block = blocks.find((x) => x.key === b.key);
      if (block) block.tasks.push(task);
      else blocks.push({ ...b, tasks: [task] });
    }
    parts.push({ part: id, tasks: blocks.flatMap((b) => b.tasks), blocks, open: inPart.filter((t) => !t.completed).length });
  }

  const openToday = onDay.filter((t) => !t.completed);
  return {
    pastDue: pastDue.sort(newestFirst),
    olderPastDueCount: older,
    parts,
    counts: {
      left: openToday.length,
      must: openToday.filter((t) => commitmentOf(t) !== "flexible").length,
      pastDue: pastDue.length + older,
      done: onDay.length - openToday.length,
    },
    comingUp: Array.from(upcoming.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, dayTasks]) => ({ date, tasks: dayTasks.sort(byTime) })),
  };
}

/** Where the Now line goes: before the first of today's timed items that hasn't
 *  started yet, or after the last timed group once they all have. Null when
 *  nothing today has a time. */
export type NowLine = { before: string } | { after: DayPart } | null;

export function nowLine(groups: TodayGroups, now: Date, tz: string): NowLine {
  const timed = groups.parts.filter((p) => p.part !== "anytime");
  if (timed.length === 0) return null;
  const minutes = localNow(tz, now).minutes;
  for (const part of timed) {
    for (const task of part.tasks) {
      const at = clockMinutes(task.time);
      if (at !== null && at >= minutes) return { before: task.id };
    }
  }
  return { after: timed[timed.length - 1].part };
}

/** The line under the greeting: "4 left today · 1 past due · next: Dentist at 3:30 PM". */
export function glanceLine(groups: TodayGroups, now: Date, tz: string): string {
  const minutes = localNow(tz, now).minutes;
  const { left, pastDue, done } = groups.counts;
  const next = groups.parts
    .flatMap((p) => p.tasks)
    .find((t) => {
      const at = clockMinutes(t.time);
      return !t.completed && commitmentOf(t) !== "flexible" && at !== null && at >= minutes;
    });

  const parts = [left > 0 ? `${left} left today` : done > 0 ? "All done for today" : "Nothing planned today"];
  if (pastDue > 0) parts.push(`${pastDue} past due`);
  if (next) parts.push(`next: ${next.title} at ${formatTime12(next.time)}`);
  return parts.join(" · ");
}
