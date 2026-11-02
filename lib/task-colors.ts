// One rule for "what color is this task", shared by every list, the calendar
// and the AI console's chat list. Four colors, by what the work is:
//   Canvas   — anything from the Canvas feed
//   Academic — school work the student adds (a "school" kind, or a title that
//              reads as schoolwork: study, quiz, essay, homework…)
//   ECs      — both extracurricular kinds (academic-ec is research, robotics,
//              competitions; side-ec is sports and hobbies)
//   Other    — commitments, personal, and anything without a signal: grey
// A project's own color no longer drives the dot.

import type { Task, TaskKind } from "./types";

export type TaskCategory = "canvas" | "academic" | "ec" | "other";

export const CATEGORY_COLOR: Record<TaskCategory, string> = {
  canvas: "var(--cat-canvas)",
  academic: "var(--cat-academic)",
  ec: "var(--cat-ec)",
  other: "var(--cat-other)",
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  canvas: "Canvas",
  academic: "Academic",
  ec: "ECs",
  other: "Other",
};

const SCHOOLWORK = /\b(stud(y|ying)|tests?|quiz(zes)?|exams?|midterms?|finals?|homework|hw|essays?|assignments?|chapters?|ch\.?\s?\d|problem sets?|psets?|worksheets?|labs?|reading|lectures?|apush|ap\s\w+|calc(ulus)?|algebra|geometry|precalc|chem(istry)?|physics|bio(logy)?|history|english|spanish|french|latin|sat|act|psat)\b/i;

type Colorable = Pick<Task, "source" | "kind"> & { title?: string; calendarId?: string | null };

export function taskCategory(task: Colorable): TaskCategory {
  if (task.source === "canvas") return "canvas";
  if (task.kind === "academic-ec" || task.kind === "side-ec") return "ec";
  if (task.kind === "school") return "academic";
  if (task.kind === "commitment") return "other";
  // Filed by Tangent (lib/capture-category.ts): the School calendar means
  // schoolwork, and an explicit personal + No school means it isn't.
  if (task.calendarId === "cal_school") return "academic";
  if (task.kind === "personal" && task.calendarId === "cal_other") return "other";
  return task.title && SCHOOLWORK.test(task.title) ? "academic" : "other";
}

export function taskColor(task: Colorable): string {
  return CATEGORY_COLOR[taskCategory(task)];
}

/** The one set of names for task kinds, used everywhere they're shown. */
export const KIND_LABEL: Record<TaskKind, string> = {
  school: "School",
  "academic-ec": "Academics",
  "side-ec": "Activities",
  commitment: "Commitment",
  personal: "Personal",
};


/** How the calendar groups work: school (classes and Canvas), projects
 *  (steps of a project), and short-term (everything else you added). */
export type TaskGroup = "school" | "projects" | "short";

export const TASK_GROUPS: { id: TaskGroup; label: string }[] = [
  { id: "school", label: "School" },
  { id: "projects", label: "Projects" },
  { id: "short", label: "Short-term" },
];

export function taskGroup(task: Pick<Task, "planId" | "kind" | "source">): TaskGroup {
  if (task.planId) return "projects";
  if (task.source === "canvas" || task.kind === "school") return "school";
  return "short";
}

/** The word a row or chip shows for its category: the same rule as its dot.
 *  Grey (Other) carries no label; the dot says enough. */
export function categoryLabel(task: Colorable): string | null {
  const c = taskCategory(task);
  return c === "other" ? null : CATEGORY_LABEL[c];
}

const CATEGORY_ORDER: TaskCategory[] = ["canvas", "academic", "ec", "other"];

/** A list split by category, in a fixed order, empty groups left out. */
export function groupByCategory<T extends Colorable>(tasks: T[]): { category: TaskCategory; tasks: T[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, tasks: tasks.filter((t) => taskCategory(t) === category) })).filter(
    (g) => g.tasks.length > 0
  );
}
