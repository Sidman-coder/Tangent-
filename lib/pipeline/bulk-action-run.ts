// Round 5A, 1.6: the two server steps of a bulk action, with the store passed
// in so they can be tested without a database.
//
//   proposeBulk   reads what they have, builds the card (lib/pipeline/bulk-action.ts
//                 planBulk) and parks it as a pending confirmation. Changes nothing.
//   runBulkConfirm  runs a confirmed one (called by app/api/confirm) and records
//                 an undo entry for everything but chats.
//
// pending_confirmations.kind and action_records.kind are check-constrained, so
// these reuse existing kinds: delete_task, reschedule_task (move) and
// complete_task (mark done). The payload's `bulk: true` tells them apart from
// the older single-task confirmations.

import type { ActionKind, ActionRecord, ActionSnapshot, Plan, Task } from "../types";
import { planBulk, type BulkAction } from "./bulk-action";

export type BulkPayload = {
  bulk: true;
  op: "delete" | "move" | "done";
  taskIds: string[];
  planIds: string[];
  chats: boolean;
  moves: { taskId: string; date: string }[];
};

export type ProposeDeps = {
  getAllTasks(): Promise<Task[]>;
  getAllPlans(): Promise<Plan[]>;
  countChatSessions(): Promise<number>;
  addPendingConfirmation(kind: ActionKind, message: string, payload: Record<string, unknown>): Promise<{ id: string; kind: string; message: string }>;
};

const KIND: Record<BulkPayload["op"], ActionKind> = { delete: "delete_task", move: "reschedule_task", done: "complete_task" };

export function isBulkPayload(p: Record<string, unknown>): p is BulkPayload & Record<string, unknown> {
  return p.bulk === true && (p.op === "delete" || p.op === "move" || p.op === "done");
}

/** The reply for a bulk command: a confirm card with counts, or "nothing to do". */
export async function proposeBulk(action: BulkAction, today: string, deps: ProposeDeps): Promise<Record<string, unknown>> {
  const [tasks, plans, chatCount] = await Promise.all([
    deps.getAllTasks(),
    deps.getAllPlans(),
    action.kind === "delete" && action.targets.includes("chats") ? deps.countChatSessions() : Promise.resolve(0),
  ]);
  const plan = planBulk(action, { tasks, plans, chatCount, today });
  if (plan.kind === "empty") return { ok: true, action: "chat_reply", message: plan.message };
  const payload: BulkPayload = { bulk: true, op: action.kind, taskIds: plan.taskIds, planIds: plan.planIds, chats: plan.chats, moves: plan.moves };
  const pending = await deps.addPendingConfirmation(KIND[action.kind], plan.message, payload);
  return { ok: true, action: "confirm_required", pending: { id: pending.id, kind: pending.kind, message: pending.message }, response: pending.message };
}

export type RunDeps = {
  getAllTasks(): Promise<Task[]>;
  deleteTasks(ids: string[]): Promise<number>;
  deleteEmptiedPlans(planIds: readonly string[]): Promise<Plan[]>;
  deleteAllChats(): Promise<number>;
  updateTask(id: string, patch: Partial<Omit<Task, "id">>): Promise<Task | null>;
  recordAction(kind: ActionKind, summary: string, snapshot: ActionSnapshot): Promise<ActionRecord>;
};

export type RunResult = { ok: true; action: ActionKind; response: string; actionId?: string } | { ok: false; error: string };

const n = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
function list(parts: string[]): string {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Updates in small groups so a long list doesn't wait one at a time. */
async function inGroups<T>(items: T[], run: (item: T) => Promise<unknown>, size = 10): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run));
}

export async function runBulkConfirm(payload: BulkPayload, deps: RunDeps): Promise<RunResult> {
  const ids = new Set(payload.taskIds);
  const tasks = (await deps.getAllTasks()).filter((t) => ids.has(t.id));

  if (payload.op === "delete") {
    // Tasks first, so a project is empty when it goes (and its steps are in the undo).
    if (tasks.length > 0) await deps.deleteTasks(tasks.map((t) => t.id));
    const removedPlans = payload.planIds.length > 0 ? await deps.deleteEmptiedPlans(payload.planIds) : [];
    const chats = payload.chats ? await deps.deleteAllChats() : 0;
    if (tasks.length === 0 && removedPlans.length === 0 && chats === 0) return { ok: false, error: "Those are already gone, so there was nothing to delete." };
    const parts: string[] = [];
    if (tasks.length > 0) parts.push(n(tasks.length, "task"));
    if (removedPlans.length > 0) parts.push(n(removedPlans.length, "project"));
    if (chats > 0) parts.push(n(chats, "chat"));
    const summary = `Deleted ${list(parts)}`;
    // Chats have no undo; everything else does.
    const record = tasks.length > 0 || removedPlans.length > 0 ? await deps.recordAction("delete_task", summary, { removedTasks: tasks, removedPlans }) : null;
    return { ok: true, action: "delete_task", response: `${summary}.`, ...(record ? { actionId: record.id } : {}) };
  }

  if (payload.op === "move") {
    const dateOf = new Map(payload.moves.map((m) => [m.taskId, m.date]));
    const open = tasks.filter((t) => !t.completed && dateOf.has(t.id));
    if (open.length === 0) return { ok: false, error: "Those tasks have changed since, so I didn't move anything." };
    await inGroups(open, (t) => deps.updateTask(t.id, { date: dateOf.get(t.id) as string }));
    const summary = `Moved ${n(open.length, "task")}`;
    const record = await deps.recordAction("reschedule_task", summary, { rescheduledMany: open.map((t) => ({ taskId: t.id, fromDate: t.date, fromTime: t.time })) });
    return { ok: true, action: "reschedule_task", response: `${summary}.`, actionId: record.id };
  }

  const open = tasks.filter((t) => !t.completed);
  if (open.length === 0) return { ok: false, error: "Those are already done, so there was nothing to mark." };
  await inGroups(open, (t) => deps.updateTask(t.id, { completed: true }));
  const summary = `Marked ${n(open.length, "task")} done`;
  // Undo for a completion in bulk: put each one's completed flag back
  // (applyUndo's restoredFields, recorded under reschedule_task).
  const record = await deps.recordAction("reschedule_task", summary, { restoredFields: open.map((t) => ({ taskId: t.id, fields: { completed: false } })) });
  return { ok: true, action: "complete_task", response: `${summary}.`, actionId: record.id };
}
