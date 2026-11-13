// What a student has on today, in the order the day happens. Home is built from
// this, so the answer to "what do I have to do?" lives in one tested place:
//   Past due   the last three days; Fresh start handles older work
//   Today      Morning / Afternoon / Evening / Late night, always all four, then
//              Anytime; each grouped by project, done items kept in place, with
//              a Now line in the part the clock is in
//   Coming up  the next three days
// Fixed items get strong overdue signals; flexible work gets a soft note and
// never turns red.

import { DEFAULT_TIMEZONE, formatTime12 } from "./dates";
import { isOnboardingSchoolTask } from "./school-block";
import { taskView } from "./task-filters";
import { commitmentOf, isCalendarImport } from "./task-kind";
import { addDaysYMD, getUserToday, localNow } from "./time";
import { planningGoal } from "./pipeline/planning-intent";
import { tracksCompletion } from "./urgency";
import type { Plan, Task } from "./types";

/** Past due shows the last three days; anything older waits behind Fresh start. */
export const PAST_DUE_DAYS = 3;
export const COMING_UP_DAYS = 3;

export type DayPart = "morning" | "afternoon" | "evening" | "night" | "anytime";

/** Home's day runs 5 AM to 5 AM (Round 4 §5.1): 12:15 AM is Late night, after
 *  Evening, not before Morning. */
export const DAY_START = 5 * 60;

export type DayPartMeta = {
  id: DayPart;
  label: string;
  range: string;
  /** The rail's time marker. */
  start: string;
  /** The faint row when the part is empty. */
  empty: string;
  /** First day-minute after the part (see dayMinutes). */
  end: number;
};

/** The time-of-day groups, in order. */
export const DAY_PARTS: readonly DayPartMeta[] = [
  { id: "morning", label: "Morning", range: "5 AM – 12 PM", start: "5 AM", empty: "Nothing this morning", end: 12 * 60 },
  { id: "afternoon", label: "Afternoon", range: "12 – 5 PM", start: "12 PM", empty: "Nothing this afternoon", end: 17 * 60 },
  { id: "evening", label: "Evening", range: "5 – 9 PM", start: "5 PM", empty: "Nothing this evening", end: 21 * 60 },
  { id: "night", label: "Late night", range: "9 PM – 5 AM", start: "9 PM", empty: "Nothing late tonight", end: 24 * 60 + DAY_START },
  { id: "anytime", label: "Anytime today", range: "", start: "", empty: "", end: Infinity },
];

/** Inside a time group, work sits under its project, "School" or "Personal". */
export type TaskGroupKind = "project" | "school" | "personal";
export type TaskBlock = {
  key: string;
  kind: TaskGroupKind;
  planId: string | null;
  /** A Path's name, for steps scheduled from one. */
  title?: string;
  tasks: Task[];
};

export type DayGroup = { part: DayPart; tasks: Task[]; blocks: TaskBlock[]; open: number };

export type TodayGroups = {
  /** Open items from the last three days, newest first. */
  pastDue: Task[];
  /** Past due items older than that. */
  olderPastDueCount: number;
  /** Morning, Afternoon, Evening and Late night, always, empty or not; then
   *  Anytime when it has anything. Done items included. */
  parts: DayGroup[];
  counts: { left: number; must: number; pastDue: number; done: number };
  comingUp: { date: string; tasks: Task[] }[];
};

export type OverdueStyle = "hard" | "soft" | null;

function clockMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes into Home's day: before 5 AM counts as the end of the day. */
function dayMinutes(clock: number): number {
  return clock < DAY_START ? clock + 24 * 60 : clock;
}

function dayClock(time: string): number | null {
  const at = clockMinutes(time);
  return at === null ? null : dayMinutes(at);
}

function partAt(minutes: number): DayPart {
  const at = dayMinutes(minutes);
  return DAY_PARTS.find((p) => at < p.end)?.id ?? "night";
}

export function dayPartOf(time: string): DayPart {
  const at = clockMinutes(time);
  return at === null ? "anytime" : partAt(at);
}

/** Timed first by time (5 AM onward), then untimed; ties keep their order. */
function byTime(a: Task, b: Task): number {
  const x = dayClock(a.time);
  const y = dayClock(b.time);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
}

function newestFirst(a: Task, b: Task): number {
  if (a.date === b.date) return byTime(a, b);
  return a.date < b.date ? 1 : -1;
}

type PlanRef = Pick<Plan, "id" | "title">;

const GOAL_LABEL = /^\s*(?:break\s*down(?:\s+(?:plan|project|goal))?|plan|goal)\s*[:\-–—]/i;
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The project a goal's own task belongs to. A goal handed to Home used to be
 *  saved as a task ("Break down plan: Get 10k followers") with no project;
 *  it goes under the project made for that goal, not Personal (Round 4 §5.1). */
export function goalPlanFor(task: Pick<Task, "title">, plans: readonly PlanRef[]): PlanRef | null {
  if (!GOAL_LABEL.test(task.title)) return null;
  const goal = normalize(planningGoal(task.title));
  if (!goal) return null;
  return (
    plans.find((p) => normalize(p.title) === goal) ??
    plans.find((p) => {
      const title = normalize(p.title);
      return title.length >= 6 && (goal.includes(title) || title.includes(goal));
    }) ??
    null
  );
}

function blockOf(task: Task, plans: readonly PlanRef[]): Omit<TaskBlock, "tasks"> {
  if (task.planId) return { key: `plan:${task.planId}`, kind: "project", planId: task.planId };
  if (task.pathOrigin) return { key: `path:${task.pathOrigin.pathId}`, kind: "project", planId: null, title: task.pathOrigin.pathTitle };
  const goalPlan = goalPlanFor(task, plans);
  if (goalPlan) return { key: `plan:${goalPlan.id}`, kind: "project", planId: goalPlan.id };
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

export function groupTodayTasks(tasks: Task[], now: Date, tz: string, plans: readonly PlanRef[] = []): TodayGroups {
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
    if (inPart.length === 0 && id === "anytime") continue;
    const blocks: TaskBlock[] = [];
    for (const task of inPart) {
      const b = blockOf(task, plans);
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

/** Where the Now line goes: always in the part the clock is in (12:15 AM is
 *  Late night), before that part's first item that hasn't started, or at the
 *  end of the part when there's none. */
export type NowLine = { part: DayPart; before: string | null };

export function nowLine(groups: TodayGroups, now: Date, tz: string): NowLine {
  const minutes = localNow(tz, now).minutes;
  const part = partAt(minutes);
  const at = dayMinutes(minutes);
  const next = groups.parts
    .find((p) => p.part === part)
    ?.tasks.find((t) => {
      const start = dayClock(t.time);
      return start !== null && start >= at;
    });
  return { part, before: next?.id ?? null };
}

/** True when today has nothing at all, so Home shows its empty state. */
export function nothingOnDay(groups: TodayGroups): boolean {
  return groups.parts.every((p) => p.tasks.length === 0);
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
