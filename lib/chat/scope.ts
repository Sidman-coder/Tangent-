// What a chat is about. One continuing thread per task and per project; Home
// is the general chat. Pure: shared by the chat routes, the library and tests.
// Relative imports so `node --test` can load it.

import type { ChatSession } from "../types";

export type ChatScope =
  | { type: "general" }
  | { type: "task"; taskId: string }
  | { type: "project"; projectId: string };

export type ChatScopeType = ChatScope["type"];

/** Home picks the last general chat back up within this long. */
export const GENERAL_CONTINUE_MS = 2 * 60 * 60 * 1000;
/** A thread gets a fresh summary about every this many messages. */
export const SUMMARY_EVERY = 6;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The scope a request body asked for, or null when it is malformed. */
export function parseScope(raw: unknown): ChatScope | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.type === "general") return { type: "general" };
  if (r.type === "task" && typeof r.taskId === "string" && UUID_RE.test(r.taskId)) return { type: "task", taskId: r.taskId };
  if (r.type === "project" && typeof r.projectId === "string" && UUID_RE.test(r.projectId)) return { type: "project", projectId: r.projectId };
  return null;
}

/** Works before the chat_scope migration: with no scope column, a chat linked
 *  to a project is that project's thread, and a chat about exactly one task
 *  (and no project) is that task's thread. */
export function scopeOfSession(session: Pick<ChatSession, "scope" | "taskId" | "planId" | "taskIds">): ChatScope {
  if (session.scope === "task" && session.taskId) return { type: "task", taskId: session.taskId };
  if (session.scope === "project" && session.planId) return { type: "project", projectId: session.planId };
  if (session.scope === "general") return { type: "general" };
  if (session.planId) return { type: "project", projectId: session.planId };
  if (session.taskIds?.length === 1) return { type: "task", taskId: session.taskIds[0] };
  return { type: "general" };
}

export function sameScope(a: ChatScope, b: ChatScope): boolean {
  if (a.type === "task" && b.type === "task") return a.taskId === b.taskId;
  if (a.type === "project" && b.type === "project") return a.projectId === b.projectId;
  return a.type === b.type;
}

/** Home continues the last general chat when it was used in the last 2 hours. */
export function canContinueGeneral(lastAt: string | null, now: Date): boolean {
  if (!lastAt) return false;
  const at = Date.parse(lastAt);
  if (!Number.isFinite(at)) return false;
  const age = now.getTime() - at;
  return age >= -60_000 && age < GENERAL_CONTINUE_MS;
}

/** True once the thread has grown by SUMMARY_EVERY messages since the last summary. */
export function shouldSummarize(messageCount: number, lastSummarizedAt: number): boolean {
  return messageCount >= SUMMARY_EVERY && messageCount - Math.max(0, lastSummarizedAt) >= SUMMARY_EVERY;
}
