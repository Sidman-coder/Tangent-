// What a student must do today, what they planned to do, and what's next. Today
// is built from this, so the answer to "what do I have to do?" lives in one
// tested place. Fixed items get strong overdue signals; flexible work gets a
// soft note and never turns red.

import { DEFAULT_TIMEZONE, formatTime12 } from "./dates";
import { isOnboardingSchoolTask } from "./school-block";
import { commitmentOf, isCalendarImport } from "./task-kind";
import { addDaysYMD, getUserToday, localNow } from "./time";
import { tracksCompletion } from "./urgency";
import type { Task } from "./types";

export const MAX_OVERDUE_SHOWN = 3;
export const COMING_UP_DAYS = 3;

export type TodayGroups = {
  mustDo: Task[];
  /** Overdue items past the newest few, shown as "+N older". */
  olderOverdueCount: number;
  todaysPlan: Task[];
  comingUp: { date: string; tasks: Task[] }[];
};

export type OverdueStyle = "hard" | "soft" | null;

function clockMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
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
  const last = addDaysYMD(today, COMING_UP_DAYS);

  const earlierHard: Task[] = [];
  const earlierSoft: Task[] = [];
  const mustToday: Task[] = [];
  const planToday: Task[] = [];
  const upcoming = new Map<string, Task[]>();

  for (const task of tasks) {
    if (task.completed || isOnboardingSchoolTask(task)) continue;
    if (task.date < today) {
      const style = overdueStyle(task, now, tz);
      if (style === "hard") earlierHard.push(task);
      else if (style === "soft") earlierSoft.push(task);
    } else if (task.date === today) {
      (commitmentOf(task) === "flexible" ? planToday : mustToday).push(task);
    } else if (task.date <= last) {
      const day = upcoming.get(task.date);
      if (day) day.push(task);
      else upcoming.set(task.date, [task]);
    }
  }

  earlierHard.sort(newestFirst);
  earlierSoft.sort(newestFirst);
  return {
    mustDo: [...earlierHard.slice(0, MAX_OVERDUE_SHOWN), ...mustToday.sort(byTime)],
    olderOverdueCount: Math.max(0, earlierHard.length - MAX_OVERDUE_SHOWN),
    todaysPlan: [...planToday.sort(byTime), ...earlierSoft],
    comingUp: Array.from(upcoming.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, dayTasks]) => ({ date, tasks: dayTasks.sort(byTime) })),
  };
}

/** The slider's first slide: "3 must-dos · next: Dentist at 3:30 PM · 2 plan steps left". */
export function glanceLine(groups: TodayGroups, now: Date, tz: string): string {
  const today = getUserToday(tz, now);
  const minutes = localNow(tz, now).minutes;
  const must = groups.mustDo.length + groups.olderOverdueCount;
  const plan = groups.todaysPlan.length;
  const next = groups.mustDo.find((t) => {
    const at = clockMinutes(t.time);
    return t.date === today && at !== null && at >= minutes;
  });

  const parts = [must === 0 ? "Nothing you have to do today" : `${must} must-do${must === 1 ? "" : "s"}`];
  if (next) parts.push(`next: ${next.title} at ${formatTime12(next.time)}`);
  if (plan > 0) parts.push(`${plan} plan step${plan === 1 ? "" : "s"} left`);
  return parts.join(" · ");
}
