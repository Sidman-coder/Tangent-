// One rule for "what color is this task", shared by every list, the calendar
// and the AI console's chat list. Four colors, by what the work is:
//   Canvas   — anything from the Canvas feed
//   Academic — school work the student adds (a "school" kind, or a title that
//              reads as schoolwork: study, quiz, essay, homework…)
//   ECs      — both extracurricular kinds (academic-ec is research, robotics,
//              competitions; side-ec is sports and hobbies)
//   Other    — commitments, personal, and anything without a signal: grey
// Those four still name what the work is, in filters and the calendar's day list.
//
// The colors a student sees on stripes, dots and blocks come from the series
// palette below: one hue per project or Canvas course, personal slate for fixed
// items with no project, neutral for the rest. Text never uses a series color.

import { isOnboardingSchoolTask } from "./school-block";
import { commitmentOf } from "./task-kind";
import type { Plan, Task, TaskKind } from "./types";

export type SeriesKey =
  | "violet"
  | "teal"
  | "rose"
  | "blue"
  | "amber"
  | "green"
  | "magenta"
  | "indigo"
  | "orange"
  | "cyan";

/** Every value has 3:1 against its theme's surfaces and 4.5:1 with readableInk
 *  (both tested). `plans.color` stores the key, so a palette change reaches
 *  every project at once. */
export const SERIES_PALETTE: Record<SeriesKey, { label: string; light: string; dark: string }> = {
  violet: { label: "Violet", light: "#6d55c7", dark: "#a08ff0" },
  teal: { label: "Teal", light: "#0f7f76", dark: "#4cc4b8" },
  rose: { label: "Rose", light: "#c43c5c", dark: "#f0708b" },
  blue: { label: "Blue", light: "#2f6dcc", dark: "#6ba4f2" },
  amber: { label: "Amber", light: "#9c660a", dark: "#e0b04c" },
  green: { label: "Green", light: "#2b8249", dark: "#62c585" },
  magenta: { label: "Magenta", light: "#ad38a1", dark: "#e078d6" },
  indigo: { label: "Indigo", light: "#3f4cb8", dark: "#8a95ee" },
  orange: { label: "Orange", light: "#c2541a", dark: "#f08f55" },
  cyan: { label: "Cyan", light: "#0d7a98", dark: "#4cbcdc" },
};

export const SERIES_KEYS = Object.keys(SERIES_PALETTE) as SeriesKey[];

/** The two colors that aren't a project: fixed items with no project, and everything else. */
const QUIET_SERIES = {
  personal: { light: "#64708a", dark: "#94a0b8" },
  neutral: { light: "#8a8699", dark: "#6f6b80" },
};

export type TaskSeries = SeriesKey | keyof typeof QUIET_SERIES;

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The text color for a colored block: white or dark ink, whichever reads better. */
export function readableInk(backgroundHex: string): "#ffffff" | "#17132a" {
  return contrastRatio(backgroundHex, "#ffffff") >= contrastRatio(backgroundHex, "#17132a") ? "#ffffff" : "#17132a";
}

function seriesDeclarations(theme: "light" | "dark"): string {
  const all: [string, { light: string; dark: string }][] = [
    ...Object.entries(SERIES_PALETTE),
    ...Object.entries(QUIET_SERIES),
  ];
  return all
    .map(([key, value]) => `--series-${key}:${value[theme]};--series-${key}-ink:${readableInk(value[theme])};`)
    .join("");
}

/** The palette as CSS variables, rendered once by the root layout. */
export const SERIES_CSS = `:root,[data-theme="light"]{${seriesDeclarations("light")}}[data-theme="dark"]{${seriesDeclarations("dark")}}`;

export function seriesColor(series: TaskSeries): string {
  return `var(--series-${series})`;
}

export function seriesInk(series: TaskSeries): string {
  return `var(--series-${series}-ink)`;
}

function isSeriesKey(value: unknown): value is SeriesKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SERIES_PALETTE, value);
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** The next project's color: the least-used hue, never the one just used. Earlier
 *  hues win ties, so a student's first projects go through the palette in order. */
export function assignProjectColor(existing: readonly string[]): SeriesKey {
  const used = existing.filter(isSeriesKey);
  const counts = new Map<SeriesKey, number>(SERIES_KEYS.map((key) => [key, 0]));
  for (const key of used) counts.set(key, (counts.get(key) ?? 0) + 1);
  const latest = used[used.length - 1];
  const candidates = SERIES_KEYS.filter((key) => key !== latest);
  let best = candidates[0];
  for (const key of candidates) {
    if ((counts.get(key) ?? 0) < (counts.get(best) ?? 0)) best = key;
  }
  return best;
}

/** A course keeps its color across every assignment and every sync. */
export function courseColor(courseName: string): SeriesKey {
  return SERIES_KEYS[hashString(courseName.trim().toLowerCase()) % SERIES_KEYS.length];
}

/** A project's hue. Projects from before the palette hold an old hex until the
 *  migration runs, or forever if it never does, so those hash by id. */
export function projectSeries(value: string | null | undefined, id: string): SeriesKey {
  return isSeriesKey(value) ? value : SERIES_KEYS[hashString(id) % SERIES_KEYS.length];
}

/** The CSS color of a project, whatever its row holds. */
export function planSeriesColor(plan: Pick<Plan, "id" | "color">): string {
  return seriesColor(projectSeries(plan.color, plan.id));
}

/** Canvas writes its course at the end of an event's title: "Lab 4 [AP Chem]". */
export function canvasCourseOf(title: string): string {
  const m = /\[([^\]]+)\]\s*$/.exec(title);
  return m ? m[1] : "Canvas";
}

export function taskSeries(task: Task, plans: readonly Pick<Plan, "id" | "color">[]): TaskSeries {
  if (task.planId) {
    const plan = plans.find((p) => p.id === task.planId);
    return projectSeries(plan?.color, task.planId);
  }
  if (task.source === "canvas") return courseColor(canvasCourseOf(task.title));
  if (isOnboardingSchoolTask(task)) return "neutral";
  return commitmentOf(task) === "flexible" ? "neutral" : "personal";
}

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
