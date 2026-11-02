// The Canvas calendar feed never says whether an assignment was submitted,
// so finished work piled up as "overdue". A Canvas item more than
// CANVAS_CLEAR_DAYS past its due date counts as handled: it leaves the lists,
// nudges and counts, and stays greyed on the calendar to look back on.

import type { Task } from "./types";
import { addDaysYMD } from "./time";

export const CANVAS_CLEAR_DAYS = 2;

type Clearable = Pick<Task, "source" | "completed" | "date">;

/** `today` is the student's own YYYY-MM-DD (getUserToday / toYMD of their wall clock). */
export function isCanvasCleared(task: Clearable, today: string): boolean {
  return task.source === "canvas" && !task.completed && task.date <= addDaysYMD(today, -CANVAS_CLEAR_DAYS);
}

export function withoutClearedCanvas<T extends Clearable>(tasks: T[], today: string): T[] {
  return tasks.filter((t) => !isCanvasCleared(t, today));
}
