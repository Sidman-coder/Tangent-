// What the AI's read of a quick capture ("academic" / "extracurricular" /
// "personal", from lib/ai/refine.ts) changes on the task. Academic goes on the
// School calendar rather than kind "school": a non-Canvas "school" task is a
// School Block (a timetable period), which drops out of every to-do list.

import type { Task } from "./types";
import { CAL_OTHER, CAL_SCHOOL } from "./calendars";

export type CaptureCategory = "academic" | "extracurricular" | "personal" | "";

export function categoryPatch(
  category: CaptureCategory,
  task: Pick<Task, "source" | "kind">
): Partial<Pick<Task, "kind" | "calendarId">> | null {
  if (!category || task.source === "canvas") return null;
  // A kind set on purpose (a project's, a commitment, a sport) wins.
  if (task.kind && task.kind !== "personal") return null;
  if (category === "academic") return { calendarId: CAL_SCHOOL };
  if (category === "extracurricular") return { kind: "academic-ec", calendarId: CAL_OTHER };
  return { kind: "personal", calendarId: CAL_OTHER };
}
