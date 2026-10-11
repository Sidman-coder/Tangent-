// Pipeline V2: reverses an applied ChangeSet, one batch step at a time.
//
// Undo is compare-and-restore: a field goes back only when this change set
// changed it AND it still holds the value the change set wrote. Anything the
// student (or a later change) edited since is left as it is now.
//
// The store functions are passed in (lib/store.ts undoBatchSteps wires the
// real ones), so this has no server-only imports and is unit tested with an
// in-memory store (undo-core.test.ts).

import type { BatchUndoStep, Plan, RestoredTaskFields, Task } from "../types";

export type UndoStore = {
  getTasksByIds(ids: string[]): Promise<Task[]>;
  getPlan(planId: string): Promise<Plan | null>;
  deleteTasks(ids: string[]): Promise<void>;
  deletePlan(planId: string): Promise<boolean>;
  restoreTasks(tasks: Task[]): Promise<void>;
  /** Puts a deleted plan back with its own id, title, colour and task list. */
  restorePlan(plan: Plan): Promise<void>;
  updateTask(taskId: string, patch: Partial<Omit<Task, "id">>): Promise<Task | null>;
  updatePlan(planId: string, patch: { title?: string; description?: string; taskIds?: string[]; taskCount?: number }): Promise<Plan | null>;
};

/** A task's value for each field, in the form undo steps store them: absent
 *  optional fields are null. */
export function fieldValues(task: Task, keys: (keyof RestoredTaskFields)[]): RestoredTaskFields {
  const out: RestoredTaskFields = {};
  for (const k of keys) {
    switch (k) {
      case "title":
      case "date":
      case "time":
        out[k] = task[k] ?? "";
        break;
      case "completed":
        out.completed = !!task.completed;
        break;
      case "calendarId":
        out.calendarId = task.calendarId ?? null;
        break;
      case "notes":
        out.notes = task.notes ?? null;
        break;
      case "kind":
        out.kind = task.kind ?? null;
        break;
    }
  }
  return out;
}

/**
 * The fields of a restore_task_fields step that may still be put back: those
 * whose current value is the one this change set wrote. Steps recorded before
 * compare-and-restore (no `set`) restore every field, as they always did.
 * Null when there is nothing to restore (or the task is gone).
 */
export function fieldsToRestore(
  step: Extract<BatchUndoStep, { type: "restore_task_fields" }>,
  current: Task | null
): RestoredTaskFields | null {
  if (!current) return null;
  const keys = Object.keys(step.fields) as (keyof RestoredTaskFields)[];
  if (!step.set) return keys.length ? step.fields : null;
  const now = fieldValues(current, keys);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (!(k in step.set)) continue;
    if (now[k] === step.set[k]) out[k] = step.fields[k];
  }
  return Object.keys(out).length ? (out as RestoredTaskFields) : null;
}

/**
 * What a restore_plan step may put back on the plan as it is now: the title
 * and description only if they still say what this change set wrote, and the
 * task list minus only the tasks this change set added. Steps recorded before
 * compare-and-restore (no `set`) put the whole original back.
 */
export function planRestorePatch(
  step: Extract<BatchUndoStep, { type: "restore_plan" }>,
  current: Plan | null
): { title?: string; description?: string; taskIds?: string[]; taskCount?: number } | null {
  if (!current) return null;
  if (!step.set) return { title: step.title, description: step.description, taskIds: step.taskIds, taskCount: step.taskCount };
  const patch: { title?: string; description?: string; taskIds?: string[]; taskCount?: number } = {};
  if (step.set.title !== undefined && current.title === step.set.title) patch.title = step.title;
  if (step.set.description !== undefined && current.description === step.set.description) patch.description = step.description;
  const added = new Set(step.addedTaskIds ?? []);
  if (added.size) {
    const kept = current.taskIds.filter((id) => !added.has(id));
    if (kept.length !== current.taskIds.length) {
      patch.taskIds = kept;
      patch.taskCount = Math.max(0, current.taskCount - (current.taskIds.length - kept.length));
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Reverses a batch: the steps run last-first. */
export async function undoStepsWith(store: UndoStore, steps: BatchUndoStep[]): Promise<void> {
  for (const step of [...steps].reverse()) {
    switch (step.type) {
      case "delete_tasks":
        await store.deleteTasks(step.taskIds);
        break;
      case "delete_plan":
        await store.deletePlan(step.planId);
        break;
      case "restore_tasks":
        await store.restoreTasks(step.tasks);
        break;
      case "restore_task_fields": {
        const [current] = step.set ? await store.getTasksByIds([step.taskId]) : [null];
        const fields = step.set ? fieldsToRestore(step, current ?? null) : step.fields;
        // null clears a column (taskPatchToRow maps null and undefined alike).
        if (fields) await store.updateTask(step.taskId, fields as Partial<Omit<Task, "id">>);
        break;
      }
      case "restore_plan": {
        const patch = planRestorePatch(step, await store.getPlan(step.planId));
        if (patch) await store.updatePlan(step.planId, patch);
        break;
      }
      case "restore_plan_row": {
        if (!(await store.getPlan(step.plan.id))) await store.restorePlan(step.plan);
        // Its tasks lost their link when it was deleted, and tasks deleted in
        // the same change set may already be back (their steps can run first).
        // Relink each one still unlinked; a task moved to another plan since
        // keeps that plan.
        const tasks = await store.getTasksByIds(step.plan.taskIds);
        for (const t of tasks) if (!t.planId) await store.updateTask(t.id, { planId: step.plan.id });
        break;
      }
    }
  }
}
