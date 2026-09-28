import type { Task } from "./types";

/**
 * Which tasks have work you could actually get help with.
 *
 * Canvas assignments always qualify: they are the student's real school work.
 * Beyond that the test is "is this work, or is this a slot in the day?" A
 * recurring entry is a School Block or a standing commitment like practice —
 * it repeats because it is a place in the timetable, and there is nothing to
 * ask about. Everything else that is school or extracurricular work qualifies,
 * including a one-off assignment typed in by hand.
 *
 * Personal tasks are left out on purpose: "Run 3 miles" does not need a
 * chat window, and putting one on every row is the clutter this avoids.
 */
export function canAskForHelp(task: Task): boolean {
  if (task.source === "canvas") return true;
  if (task.recurring?.enabled) return false;
  if (task.kind === "commitment") return false;
  return task.kind === "school" || task.kind === "academic-ec" || task.kind === "side-ec";
}
