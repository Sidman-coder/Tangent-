// The recurring School block onboarding creates. Onboarding used to add a new
// series every time setup ran, so "Redo setup" stacked duplicate School
// blocks. These pure helpers find the existing onboarding series so the store
// can replace them with exactly one (lib/store.ts replaceSchoolBlock).

import { formatTime12 } from "./dates";
import type { SchoolHours } from "./onboarding";
import { parseSchoolHours } from "./onboarding";
import { schoolEndFromNotes } from "./schedule-slots";
import type { Task } from "./types";

export const SCHOOL_TITLE = "School";
/** How far ahead a School series runs, as it always has. */
export const SCHOOL_SERIES_WEEKS = 16;

/** A task that belongs to an onboarding School series: recurring, kind
 *  "school", not from Canvas, and titled "School" or carrying the "Until…"
 *  note onboarding writes. A one-off test tagged "school" never matches. */
export function isOnboardingSchoolTask(t: Task): boolean {
  if (t.kind !== "school" || t.source === "canvas") return false;
  if (!t.recurring?.parentId) return false;
  return t.title.trim().toLowerCase() === "school" || schoolEndFromNotes(t.notes) !== null;
}

/** Every onboarding School series id, oldest first. */
export function schoolSeriesIds(tasks: Task[]): string[] {
  const ids = new Set<string>();
  for (const t of tasks) if (isOnboardingSchoolTask(t)) ids.add(t.recurring!.parentId!);
  return Array.from(ids).sort();
}

export function schoolNotes(end: string): string {
  return `Until ${formatTime12(end)}`;
}

/** The schedule the newest School series describes, or null when there is
 *  none (or it can't be read back, e.g. an old block with no "Until" note). */
export function schoolHoursFromTasks(tasks: Task[]): SchoolHours | null {
  const ids = schoolSeriesIds(tasks);
  const newest = ids[ids.length - 1];
  if (!newest) return null;
  const sample = tasks.find((t) => t.recurring?.parentId === newest && isOnboardingSchoolTask(t));
  if (!sample) return null;
  const endMin = schoolEndFromNotes(sample.notes);
  if (endMin === null) return null;
  const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  return parseSchoolHours({ days: sample.recurring?.daysOfWeek ?? [], start: sample.time, end });
}

/** The School series to add for `hours`, starting on `today`. */
export function schoolSeriesFor(hours: SchoolHours, today: string, endDate: string) {
  return {
    task: {
      title: SCHOOL_TITLE,
      date: today,
      time: hours.start,
      completed: false,
      kind: "school" as const,
      calendarId: "cal_personal",
      notes: schoolNotes(hours.end),
    },
    recurring: { frequency: "weekly" as const, daysOfWeek: [...hours.days], endDate },
  };
}

export type SchoolReplacePlan = {
  /** Every onboarding School series to delete, by recurring_parent_id. */
  deleteSeries: string[];
  /** The one series to add afterwards, or null when school hours were skipped. */
  add: ReturnType<typeof schoolSeriesFor> | null;
};

/** What "save these school hours" does to the student's tasks. Deleting every
 *  earlier onboarding series before adding one is what makes setup
 *  idempotent: however many times it runs, one series (or none) remains. */
export function planSchoolReplace(tasks: Task[], hours: SchoolHours | null, today: string, endDate: string): SchoolReplacePlan {
  return {
    deleteSeries: schoolSeriesIds(tasks),
    add: hours ? schoolSeriesFor(hours, today, endDate) : null,
  };
}
