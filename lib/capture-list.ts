// What the capture home lists: what's still yours to do, soonest first.
// Pure, so it can be tested without the app.

import type { Plan, Task } from "./types";
import { addDaysYMD } from "./time";
import { tracksCompletion } from "./urgency";
import { isCanvasCleared } from "./canvas-clear";
import { commitmentOf } from "./task-kind";

export const CAPTURE_WINDOW_DAYS = 14;

export type CaptureRow = { task: Task; sub: string; overdue: boolean };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function whenLabel(date: string, today: string): string {
  if (!date) return "";
  if (date < today) return "Overdue";
  if (date === today) return "Today";
  if (date === addDaysYMD(today, 1)) return "Tomorrow";
  const [y, m, d] = date.split("-").map(Number);
  if (date <= addDaysYMD(today, 6)) return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${MONTHS[m - 1]} ${d}`;
}

export function buildCaptureList(tasks: Task[], plans: Plan[], today: string): CaptureRow[] {
  const horizon = addDaysYMD(today, CAPTURE_WINDOW_DAYS);
  return tasks
    .filter((t) => !t.completed && tracksCompletion(t) && !isCanvasCleared(t, today) && (!t.date || t.date <= horizon))
    .sort((a, b) => {
      // Undated work goes last; the rest is by day, then time.
      if (!a.date !== !b.date) return a.date ? -1 : 1;
      return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    })
    .map((task) => {
      const plan = task.planId ? plans.find((p) => p.id === task.planId) : undefined;
      const where = task.source === "canvas" ? "Canvas" : plan?.title;
      const when = whenLabel(task.date, today);
      return {
        task,
        sub: [when, where].filter(Boolean).join(" · "),
        overdue: Boolean(task.date) && task.date < today,
      };
    });
}

// Round 4 Phase 4: the list in groups, not one stack. Urgent is what has to
// happen now (late, or a must-do due today or tomorrow); then school
// assignments; then project steps; then anything else that's yours.

export type CaptureGroupId = "urgent" | "school" | "projects" | "personal";
/** The chips above the list. */
export type CaptureLens = "all" | "urgent" | "projects";

export const CAPTURE_LENSES: { id: CaptureLens; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "projects", label: "Projects" },
];

const GROUP_LABEL: Record<CaptureGroupId, string> = {
  urgent: "Urgent",
  school: "Assignments",
  projects: "Projects",
  personal: "Personal",
};

export type CaptureSection = { id: string; group: CaptureGroupId; label: string; rows: CaptureRow[] };

const isProject = (t: Task) => Boolean(t.planId || t.pathNodeId);

export function captureGroup(row: CaptureRow, today: string): CaptureGroupId {
  const t = row.task;
  const soon = Boolean(t.date) && t.date <= addDaysYMD(today, 1);
  // A goal step can slide, so only a late one is urgent.
  if (row.overdue || (soon && commitmentOf(t) !== "flexible")) return "urgent";
  if (isProject(t)) return "projects";
  if (t.source === "canvas" || t.kind === "school") return "school";
  return "personal";
}

/** The list cut into sections for a chip. Rows keep their order (soonest
 *  first) inside each section; empty sections are left out. "Projects" shows
 *  every project step, urgent or not, one section per project. */
export function captureSections(rows: CaptureRow[], plans: Plan[], today: string, lens: CaptureLens = "all"): CaptureSection[] {
  if (lens === "projects") {
    const byPlan = new Map<string, CaptureRow[]>();
    for (const row of rows) {
      if (!isProject(row.task)) continue;
      const key = row.task.planId ?? "tangent";
      byPlan.set(key, [...(byPlan.get(key) ?? []), row]);
    }
    return Array.from(byPlan).map(([key, list]) => ({
      id: `plan-${key}`,
      group: "projects" as const,
      label: plans.find((p) => p.id === key)?.title ?? (key === "tangent" ? "Tangents" : "Project"),
      rows: list,
    }));
  }
  const order: CaptureGroupId[] = lens === "urgent" ? ["urgent"] : ["urgent", "school", "projects", "personal"];
  const buckets = new Map<CaptureGroupId, CaptureRow[]>(order.map((g) => [g, []]));
  for (const row of rows) buckets.get(captureGroup(row, today))?.push(row);
  return order
    .map((g) => ({ id: g, group: g, label: GROUP_LABEL[g], rows: buckets.get(g) ?? [] }))
    .filter((s) => s.rows.length > 0);
}

export function parseCaptureLens(raw: string | null): CaptureLens {
  return CAPTURE_LENSES.find((l) => l.id === raw)?.id ?? "all";
}
