// One rule for "what color is this task", shared by the calendar and the AI
// console's chat list so a chat about a task carries the task's calendar color.
// Order: the task's plan color → its calendar category → its TaskKind token.

import type { CalendarDef, Plan, Task, TaskKind } from "@/lib/types";

export const KIND_COLOR: Record<TaskKind, string> = {
  school: "var(--kind-school)",
  "academic-ec": "var(--kind-academic-ec)",
  "side-ec": "var(--kind-side-ec)",
  commitment: "var(--kind-commitment)",
  personal: "var(--kind-personal)",
};

export const KIND_LABEL: Record<TaskKind, string> = {
  school: "School",
  "academic-ec": "Academic EC",
  "side-ec": "Side EC",
  commitment: "Commitment",
  personal: "Personal",
};

export function taskColor(
  task: Pick<Task, "planId" | "calendarId" | "kind">,
  plans: Plan[],
  calendars: Pick<CalendarDef, "id" | "category">[]
): string {
  const plan = task.planId ? plans.find((p) => p.id === task.planId) : null;
  if (plan) return plan.color;
  const cal = calendars.find((c) => c.id === task.calendarId);
  if (cal) {
    if (cal.category === "work") return "var(--cal-work)";
    if (cal.category === "personal") return "var(--cal-personal)";
    if (cal.category !== "ALL") return "var(--cal-all)";
  }
  return KIND_COLOR[task.kind ?? "personal"];
}
