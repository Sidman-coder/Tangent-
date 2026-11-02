// What the capture home lists: what's still yours to do, soonest first.
// Pure, so it can be tested without the app.

import type { Plan, Task } from "./types";
import { addDaysYMD } from "./time";
import { tracksCompletion } from "./urgency";
import { isCanvasCleared } from "./canvas-clear";

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
