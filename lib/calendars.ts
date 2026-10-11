// The calendars a student sees: All, School, No school. They are fixed, not
// per-student rows. Every task belongs to exactly one of School or No school;
// "All" is only a view.
//
// The calendars table and older tasks still carry the original ids
// (cal_personal, cal_work, cal_study, and any calendar a student added). The
// store maps every task onto the two groups as it is read (taskFromRow), so
// nothing above the store — UI, AI prompts, tools, filters — ever sees an old
// id, and no data migration is needed.

import type { CalendarDef, Task } from "./types";

export const CAL_ALL = "cal_all";
export const CAL_SCHOOL = "cal_school";
export const CAL_OTHER = "cal_other";
export type CalendarGroupId = typeof CAL_SCHOOL | typeof CAL_OTHER;

export const CALENDARS: CalendarDef[] = [
  { id: CAL_ALL, name: "All", category: "ALL" },
  { id: CAL_SCHOOL, name: "School", category: "school" },
  { id: CAL_OTHER, name: "No school", category: "other" },
];

/** Words that mark a task as schoolwork when nothing else decides it. */
const SCHOOL_WORDS =
  /\b(homework|hw|assignment|essay|exam|test|quiz|midterm|class|lecture|lab report|worksheet|study|studying|problem set|pset|teacher|school|ap \w+)\b/;

/** Which group a piece of text belongs to, for tasks created without one. */
export function inferCalendarGroup(title: string, notes?: string): CalendarGroupId {
  return SCHOOL_WORDS.test(`${title} ${notes ?? ""}`.toLowerCase()) ? CAL_SCHOOL : CAL_OTHER;
}

/** The group a stored task belongs to. Canvas imports and kind "school" are
 *  always School; the old Study calendar maps to School; everything else
 *  (Personal, Work, custom calendars, extracurriculars) is No school. A task
 *  stored with no calendar is sorted by its title. */
export function calendarGroupOf(task: Pick<Task, "calendarId" | "kind" | "source" | "title" | "notes">): CalendarGroupId {
  if (task.calendarId === CAL_SCHOOL || task.calendarId === CAL_OTHER) return task.calendarId;
  if (task.source === "canvas" || task.kind === "school") return CAL_SCHOOL;
  if (task.calendarId === "cal_study") return CAL_SCHOOL;
  if (!task.calendarId || task.calendarId === CAL_ALL) return inferCalendarGroup(task.title, task.notes);
  return CAL_OTHER;
}

/** Turns whatever the AI or a client sent ("school", "No school", an old id)
 *  into one of the two group ids, or null when it names neither. */
export function parseCalendarGroup(input: string | undefined | null): CalendarGroupId | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (v === CAL_SCHOOL || v === "school" || v === "cal_study" || v === "study") return CAL_SCHOOL;
  if (
    v === CAL_OTHER ||
    v === "no school" ||
    v === "not school" ||
    v === "other" ||
    ["cal_personal", "cal_work", "personal", "work"].includes(v)
  ) {
    return CAL_OTHER;
  }
  return null;
}
