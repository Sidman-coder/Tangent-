// The filter chips above the to-do list (Today and the capture home). Day and
// time of day combine; a task with no time can't match a time of day, so it
// shows under "Any" in the "No time yet" group. Pure, so it can be tested.

import { isDueOnly } from "./dates";
import { addDaysYMD } from "./time";
import { startOfPreviewWeek, type WeekStart } from "./month-grid";

export type DayFilter = "today" | "tomorrow" | "week" | "all";
export type TimeFilter = "morning" | "afternoon" | "evening" | "any";
export type TaskFilter = { day: DayFilter; time: TimeFilter };

export const DAY_FILTERS: { id: DayFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "all", label: "All" },
];
export const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
];
export const NO_TIME_LABEL = "No time yet";

type Filterable = { date: string; time: string; source?: string | null };

/** Morning is before 12:00, afternoon 12:00 through 17:00, evening after 17:00.
 *  Null when the task has no time to go by (none set, or a due date only). */
export function timeOfDay(task: Pick<Filterable, "time" | "source">): Exclude<TimeFilter, "any"> | null {
  if (!task.time || isDueOnly(task)) return null;
  if (task.time < "12:00") return "morning";
  return task.time <= "17:00" ? "afternoon" : "evening";
}

/** Last day of the week containing `ymd`. */
export function endOfWeek(ymd: string, weekStart: WeekStart = 1): string {
  return addDaysYMD(startOfPreviewWeek(ymd, weekStart), 6);
}

/** Overdue work counts as today and this week, so a filter never hides it.
 *  A task with no date only shows under All. */
export function matchesDay(date: string, day: DayFilter, today: string, weekStart?: WeekStart): boolean {
  if (day === "all") return true;
  if (!date) return false;
  if (day === "today") return date <= today;
  if (day === "tomorrow") return date === addDaysYMD(today, 1);
  return date <= endOfWeek(today, weekStart);
}

/** `of` reads the task out of whatever the list holds; order is kept. */
export function applyTaskFilter<T>(items: T[], of: (item: T) => Filterable, filter: TaskFilter, today: string, weekStart?: WeekStart): { main: T[]; noTime: T[] } {
  const main: T[] = [];
  const noTime: T[] = [];
  for (const item of items) {
    const task = of(item);
    if (!matchesDay(task.date, filter.day, today, weekStart)) continue;
    const when = timeOfDay(task);
    if (when === null) {
      if (filter.time !== "any") continue;
      // Overdue work keeps its place in the list; it shouldn't sink.
      (task.date && task.date < today ? main : noTime).push(item);
    } else if (filter.time === "any" || filter.time === when) {
      main.push(item);
    }
  }
  return { main, noTime };
}

/** A saved filter, or the fallback when it's missing or from an older build. */
export function parseTaskFilter(raw: string | null, fallback: TaskFilter): TaskFilter {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<TaskFilter> | null;
    const day = DAY_FILTERS.find((f) => f.id === v?.day)?.id;
    const time = TIME_FILTERS.find((f) => f.id === v?.time)?.id;
    return day && time ? { day, time } : fallback;
  } catch {
    return fallback;
  }
}
