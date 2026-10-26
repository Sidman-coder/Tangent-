// "Do it now": a focus session on one task, kept in localStorage so a reload
// picks the countdown back up. Pure helpers; FocusView does the storage.

import type { Task } from "./types";

export const FOCUS_MINUTES = 25;
export const EXTEND_MINUTES = 10;
export const FOCUS_KEY = "tangent-focus";

export type FocusSession = { taskId: string; endsAt: number };

export function startFocus(taskId: string, now: number, minutes = FOCUS_MINUTES): FocusSession {
  return { taskId, endsAt: now + minutes * 60_000 };
}

/** Another EXTEND_MINUTES, counted from now (the session has usually run out). */
export function extendFocus(s: FocusSession, now: number): FocusSession {
  return startFocus(s.taskId, Math.max(now, s.endsAt), EXTEND_MINUTES);
}

export function remainingMs(s: FocusSession, now: number): number {
  return Math.max(0, s.endsAt - now);
}

export function parseFocus(raw: string | null): FocusSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FocusSession>;
    return typeof v.taskId === "string" && typeof v.endsAt === "number" ? { taskId: v.taskId, endsAt: v.endsAt } : null;
  } catch {
    return null;
  }
}

export function firstStep(task: Pick<Task, "startAction">): string {
  return task.startAction?.trim() || "Open it and do the first 5 minutes.";
}
