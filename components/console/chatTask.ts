// Resolves which task (or plan) a chat is about, and the color and session
// dates to show for it. The color comes from lib/task-colors, the same rule
// the calendar uses, so a chat matches its task on the calendar.

import type { ChatSession } from "@/lib/store";
import type { AppState, Task } from "@/lib/types";
import { KIND_LABEL, taskColor } from "@/lib/task-colors";

export type ChatTask = {
  color: string;
  name: string;
  /** "Plan · 6 sessions", "School · 1 session", … */
  detail: string;
  sessions: Pick<Task, "id" | "date" | "time" | "title" | "completed">[];
};

export function resolveChatTask(session: ChatSession, state: AppState | null): ChatTask | null {
  if (!state) return null;
  const plan = session.planId ? state.plans.find((p) => p.id === session.planId) : undefined;
  const byDate = (a: Task, b: Task) => (a.date + a.time).localeCompare(b.date + b.time);

  if (plan) {
    const sessions = state.tasks.filter((t) => t.planId === plan.id).sort(byDate);
    return {
      color: plan.color,
      name: plan.title,
      detail: `Plan · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
      sessions,
    };
  }

  const linked = (session.taskIds ?? [])
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
  if (linked.length === 0) return null;

  // Color by the first task the chat touched; list every linked session.
  const primary = linked[0];
  const sessions = linked.slice().sort(byDate);
  const titles = new Set(linked.map((t) => t.title));
  const kind = KIND_LABEL[primary.kind ?? "personal"];
  return {
    color: taskColor(primary, state.plans, state.calendars),
    name: titles.size > 1 ? `${primary.title} +${titles.size - 1} more` : primary.title,
    detail: `${kind} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
    sessions,
  };
}
