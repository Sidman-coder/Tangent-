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
  if (date < today) return "Past due";
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

// Round 5A Phase 3: /capture reads top to bottom as "Now" (today's, due and
// overdue), an "All tasks" button, then "Projects & goals" grouped by project.
// The Urgent and Projects chips stay as other views of the same rows.

export type CaptureGroupId = "now" | "urgent" | "projects";
/** The chips above the list. */
export type CaptureLens = "all" | "urgent" | "projects";

export const CAPTURE_LENSES: { id: CaptureLens; label: string }[] = [
  { id: "all", label: "All" },
  { id: "urgent", label: "Urgent" },
  { id: "projects", label: "Projects" },
];

export type CaptureSection = { id: string; group: CaptureGroupId; label: string; rows: CaptureRow[] };

const isProject = (t: Task) => Boolean(t.planId || t.pathNodeId);

/** School and Work are projects too, but their items are real deadlines, not
 *  goal steps, so they can still be urgent. */
function isGoalStep(t: Task, plans: Plan[]): boolean {
  if (t.pathNodeId) return true;
  if (!t.planId) return false;
  const kind = plans.find((p) => p.id === t.planId)?.kind;
  return kind !== "school" && kind !== "work";
}

/** Urgent is only a reminder or a fixed-time must-do (an appointment, a class,
 *  a deadline). A goal step is never urgent, even late or due today: it can
 *  slide. Whether it's due soon is a separate question (urgentRows). */
export function isUrgent(t: Task, plans: Plan[]): boolean {
  if (isGoalStep(t, plans)) return false;
  const c = commitmentOf(t);
  return c === "fixed" || c === "reminder";
}

/** What the Urgent chip and the "N urgent" count show: urgent kinds that are
 *  late or due by tomorrow. */
export function urgentRows(rows: CaptureRow[], plans: Plan[], today: string): CaptureRow[] {
  const tomorrow = addDaysYMD(today, 1);
  return rows.filter((r) => Boolean(r.task.date) && r.task.date <= tomorrow && isUrgent(r.task, plans));
}

/** Today's, due and overdue, plus undated personal to-dos (they're "any time",
 *  so now). Later personal work lives behind "All tasks". */
function isNow(row: CaptureRow, today: string): boolean {
  const t = row.task;
  if (t.date) return t.date <= today;
  return !isProject(t);
}

function byProject(rows: CaptureRow[], plans: Plan[]): CaptureSection[] {
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

/** The list cut into sections for a chip. Rows keep their order (soonest
 *  first) inside each section; empty sections are left out.
 *  - all: "Now", then one section per project for the steps not already in Now
 *  - urgent: urgentRows only
 *  - projects: every project step, one section per project */
export function captureSections(rows: CaptureRow[], plans: Plan[], today: string, lens: CaptureLens = "all"): CaptureSection[] {
  if (lens === "projects") return byProject(rows, plans);
  if (lens === "urgent") {
    const urgent = urgentRows(rows, plans, today);
    return urgent.length ? [{ id: "urgent", group: "urgent", label: "Urgent", rows: urgent }] : [];
  }
  const now = rows.filter((r) => isNow(r, today));
  const later = rows.filter((r) => !isNow(r, today));
  return [
    ...(now.length ? [{ id: "now", group: "now" as const, label: "Now", rows: now }] : []),
    ...byProject(later, plans),
  ];
}

export function parseCaptureLens(raw: string | null): CaptureLens {
  return CAPTURE_LENSES.find((l) => l.id === raw)?.id ?? "all";
}

// Round 5A Phase 3: /tasks, the "All tasks" page. Every open task, no
// two-week window, in four plain groups.

export type AllTasksGroup = { id: "overdue" | "today" | "upcoming" | "undated"; label: string; tasks: Task[] };

export function allTasksGroups(tasks: Task[], today: string): AllTasksGroup[] {
  const open = tasks
    .filter((t) => !t.completed && tracksCompletion(t) && !isCanvasCleared(t, today))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time));
  const groups: AllTasksGroup[] = [
    { id: "overdue", label: "Past due", tasks: open.filter((t) => t.date && t.date < today) },
    { id: "today", label: "Today", tasks: open.filter((t) => t.date === today) },
    { id: "upcoming", label: "Upcoming", tasks: open.filter((t) => t.date && t.date > today) },
    { id: "undated", label: "No date", tasks: open.filter((t) => !t.date) },
  ];
  return groups.filter((g) => g.tasks.length > 0);
}
