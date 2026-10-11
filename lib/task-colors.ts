// One rule for "what color is this task", shared by the calendar and the AI
// console's chat list so a chat about a task carries the task's calendar color.
// Order: the task's plan color → its TaskKind token.

import type { Plan, Task, TaskKind } from "@/lib/types";

export const KIND_COLOR: Record<TaskKind, string> = {
  school: "var(--kind-school)",
  "academic-ec": "var(--kind-academic-ec)",
  "side-ec": "var(--kind-side-ec)",
  commitment: "var(--kind-commitment)",
  personal: "var(--kind-personal)",
};

/** The one set of names for task kinds, used everywhere they're shown. */
export const KIND_LABEL: Record<TaskKind, string> = {
  school: "School",
  "academic-ec": "Academics",
  "side-ec": "Activities",
  commitment: "Commitment",
  personal: "Personal",
};

export function taskColor(task: Pick<Task, "planId" | "kind">, plans: Plan[]): string {
  const plan = task.planId ? plans.find((p) => p.id === task.planId) : null;
  if (plan) return plan.color;
  // School / No school is a filter, not a color: the kind says more.
  return KIND_COLOR[task.kind ?? "personal"];
}
