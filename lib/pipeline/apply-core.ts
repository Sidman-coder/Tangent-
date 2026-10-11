// Pipeline V2: applies a confirmed ChangeSet to the student's calendar.
//
// The store functions are passed in, so this file has no server-only imports
// and the rollback paths can be unit-tested with an in-memory store
// (apply-core.test.ts). lib/pipeline/apply.ts wires in the real store.

import type * as Store from "../store";
import type { BatchUndoStep, Plan, RestoredTaskFields, Task } from "../types";
import { parseChangeSet, type ChangeOp, type ChangeSet } from "./changeset";

/** The store functions applyChangeSetWith uses. */
export type ApplyStore = Pick<
  typeof Store,
  | "addPlanWithTasks"
  | "addTask"
  | "deleteTask"
  | "getAllPlans"
  | "getAllTasks"
  | "getChangeSet"
  | "markChangeSet"
  | "recordAction"
  | "retireAction"
  | "undoBatchSteps"
  | "updatePlan"
  | "updateTask"
>;

export type ApplyResult =
  | {
      ok: true;
      changeSet: ChangeSet;
      /** The single undo entry (action_records.id), or null when nothing changed. */
      actionId: string | null;
      createdTaskIds: string[];
      createdPlanIds: string[];
      /** Tasks not added because the student already had a near-identical open
       *  task (the store's duplicate rule). The preview can mention them. */
      skipped_duplicates: { count: number; titles: string[] };
    }
  | {
      ok: false;
      reason: "invalid" | "not_found" | "already_confirmed" | "discarded" | "undone" | "stale" | "failed";
      message: string;
    };

/** A target that no longer matches the calendar (deleted task or plan). */
class StaleError extends Error {}

type AddTaskOp = Extract<ChangeOp, { op: "add_task" }>;

function newTask(op: AddTaskOp): Omit<Task, "id" | "planId"> {
  const t: Omit<Task, "id" | "planId"> = { title: op.title, date: op.date, time: op.time ?? "", completed: false };
  if (op.kind !== undefined) t.kind = op.kind;
  if (op.calendarId !== undefined) t.calendarId = op.calendarId;
  if (op.notes !== undefined) t.notes = op.notes;
  if (op.startAction !== undefined) t.startAction = op.startAction;
  if (op.resources !== undefined) t.resources = op.resources;
  return t;
}

const taskKey = (t: { title: string; date: string; time?: string }) => `${t.title}\u0000${t.date}\u0000${t.time ?? ""}`;

/** The current value of each field an op is about to change, so undo can put
 *  it back. Absent optional fields come back as null, which clears them. */
function priorFields(task: Task, keys: (keyof RestoredTaskFields)[]): RestoredTaskFields {
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
 * Applies a saved draft ChangeSet with the existing store functions and
 * records ONE undo entry covering only what was actually created or changed.
 *
 * The stored copy (what the student previewed) is applied, not the argument.
 * Its id is the idempotency key: the draft → confirmed claim is atomic, so a
 * ChangeSet that is already confirmed (a double click, a retry) is refused.
 * The last write stamps applied_at (and the undo entry), so a second confirm
 * can tell "finished, nothing created" from "still writing".
 * If anything fails partway, the changes made so far are reversed, an undo
 * entry already written is removed, and the ChangeSet goes back to draft.
 */
export async function applyChangeSetWith(store: ApplyStore, input: ChangeSet): Promise<ApplyResult> {
  const parsed = parseChangeSet(input);
  if (!parsed.ok) return { ok: false, reason: "invalid", message: parsed.error };

  const stored = await store.getChangeSet(parsed.changeSet.id);
  if (!stored) return { ok: false, reason: "not_found", message: "That change set could not be found." };
  if (stored.status !== "draft") return refused(stored.status);
  if (!(await store.markChangeSet(stored.id, "confirmed", { from: "draft" }))) {
    const now = await store.getChangeSet(stored.id);
    return refused(now?.status ?? "confirmed");
  }

  const steps: BatchUndoStep[] = [];
  const createdTaskIds: string[] = [];
  const createdPlanIds: string[] = [];
  const skippedTitles: string[] = [];
  let actionId: string | null = null;

  try {
    const [tasks, plans] = await Promise.all([store.getAllTasks(), store.getAllPlans()]);
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const planById = new Map(plans.map((p) => [p.id, p]));
    /** Plans this ChangeSet changes: the original (for undo) and the current state. */
    const touchedPlans = new Map<string, { original: Plan; current: Plan }>();
    const touchPlan = (planId: string) => {
      let entry = touchedPlans.get(planId);
      if (!entry) {
        const plan = planById.get(planId);
        if (!plan) throw new StaleError("A plan in this change no longer exists.");
        entry = { original: plan, current: { ...plan, taskIds: [...plan.taskIds] } };
        touchedPlans.set(planId, entry);
        const { title, description, taskIds, taskCount } = plan;
        steps.push({ type: "restore_plan", planId, title, description, taskIds: [...taskIds], taskCount });
      }
      return entry;
    };
    const existingTask = (taskId: string) => {
      const task = taskById.get(taskId);
      if (!task) throw new StaleError("A task in this change no longer exists.");
      return task;
    };

    for (const op of stored.ops) {
      switch (op.op) {
        case "create_plan": {
          const planOps = stored.ops.filter((o): o is AddTaskOp => o.op === "add_task" && o.plan_ref === op.ref);
          const wanted = planOps.map(newTask);
          // The undo steps are recorded as each row is written, so a failure
          // later inside addPlanWithTasks (the plan's task-list update) still
          // rolls back the plan and its tasks.
          const result = await store.addPlanWithTasks({ title: op.title, description: op.notes ?? "" }, wanted, {
            onPlanCreated: (planId) => {
              createdPlanIds.push(planId);
              steps.push({ type: "delete_plan", planId });
            },
            onTasksInserted: (inserted) => {
              const ids = inserted.map((t) => t.id);
              if (ids.length) steps.push({ type: "delete_tasks", taskIds: ids });
              createdTaskIds.push(...ids);
            },
          });
          // addPlanWithTasks only reports a count; the titles are the requested
          // tasks that have no inserted counterpart.
          const inserted = new Map<string, number>();
          for (const t of result.tasks) inserted.set(taskKey(t), (inserted.get(taskKey(t)) ?? 0) + 1);
          for (const t of wanted) {
            const left = inserted.get(taskKey(t)) ?? 0;
            if (left > 0) inserted.set(taskKey(t), left - 1);
            else skippedTitles.push(t.title);
          }
          break;
        }
        case "update_plan": {
          const entry = touchPlan(op.plan_id);
          const updated = await store.updatePlan(op.plan_id, { title: op.title, description: op.notes });
          if (!updated) throw new StaleError("A plan in this change no longer exists.");
          entry.current = { ...entry.current, title: updated.title, description: updated.description };
          break;
        }
        case "add_task": {
          if (op.plan_ref) break; // added with its new plan above
          const entry = op.plan_id ? touchPlan(op.plan_id) : null;
          const created = await store.addTask({ ...newTask(op), planId: op.plan_id ?? null });
          if (created.wasDuplicate) {
            skippedTitles.push(op.title);
            break;
          }
          steps.push({ type: "delete_tasks", taskIds: [created.id] });
          createdTaskIds.push(created.id);
          if (entry) {
            entry.current.taskIds.push(created.id);
            entry.current.taskCount += 1;
          }
          break;
        }
        case "update_task": {
          const task = existingTask(op.task_id);
          const patch: Partial<Omit<Task, "id">> = {};
          if (op.title !== undefined) patch.title = op.title;
          if (op.date !== undefined) patch.date = op.date;
          if (op.time !== undefined) patch.time = op.time;
          if (op.calendarId !== undefined) patch.calendarId = op.calendarId;
          if (op.notes !== undefined) patch.notes = op.notes;
          if (op.kind !== undefined) patch.kind = op.kind;
          steps.push({ type: "restore_task_fields", taskId: task.id, fields: priorFields(task, Object.keys(patch) as (keyof RestoredTaskFields)[]) });
          const updated = await store.updateTask(task.id, patch);
          if (!updated) throw new StaleError("A task in this change no longer exists.");
          taskById.set(task.id, updated);
          break;
        }
        case "move_task": {
          const task = existingTask(op.task_id);
          const patch: Partial<Omit<Task, "id">> = { date: op.date };
          if (op.time !== undefined) patch.time = op.time;
          steps.push({ type: "restore_task_fields", taskId: task.id, fields: priorFields(task, Object.keys(patch) as (keyof RestoredTaskFields)[]) });
          const updated = await store.updateTask(task.id, patch);
          if (!updated) throw new StaleError("A task in this change no longer exists.");
          taskById.set(task.id, updated);
          break;
        }
        case "complete_task": {
          const task = existingTask(op.task_id);
          if (task.completed) break; // already done: nothing to change or undo
          steps.push({ type: "restore_task_fields", taskId: task.id, fields: { completed: false } });
          const updated = await store.updateTask(task.id, { completed: true });
          if (!updated) throw new StaleError("A task in this change no longer exists.");
          taskById.set(task.id, updated);
          break;
        }
        case "delete_task": {
          const task = existingTask(op.task_id);
          if (!(await store.deleteTask(task.id))) throw new StaleError("A task in this change no longer exists.");
          steps.push({ type: "restore_tasks", tasks: [task] });
          taskById.delete(task.id);
          break;
        }
      }
    }

    // Tasks added to existing plans: write each plan's task list once.
    for (const [planId, { original, current }] of Array.from(touchedPlans)) {
      if (current.taskIds.length === original.taskIds.length) continue;
      await store.updatePlan(planId, { taskIds: current.taskIds, taskCount: current.taskCount });
    }

    if (steps.length > 0) {
      const record = await store.recordAction("apply_changeset", stored.summary, { batch: { changeSetId: stored.id, steps } });
      actionId = record.id;
    }
    // The last write: nothing after it can fail the apply.
    if (!(await store.markChangeSet(stored.id, "confirmed", { from: "confirmed", actionId, applied: true }))) {
      throw new Error("the change set left confirmed while it was being applied");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[pipeline] applyChangeSet failed, rolling back:", stored.id, message);
    // Remove the undo entry first, so no Undo can run against rolled-back changes.
    if (actionId) {
      await store.retireAction(actionId).catch((retireError: unknown) => {
        console.error("[pipeline] applyChangeSet could not remove its undo entry:", actionId, retireError instanceof Error ? retireError.message : retireError);
      });
    }
    try {
      await store.undoBatchSteps(steps);
    } catch (rollbackError) {
      console.error("[pipeline] applyChangeSet rollback failed:", stored.id, rollbackError instanceof Error ? rollbackError.message : rollbackError);
    }
    await store.markChangeSet(stored.id, "draft", { from: "confirmed" }).catch(() => false);
    if (e instanceof StaleError) return { ok: false, reason: "stale", message };
    return { ok: false, reason: "failed", message: "Those changes couldn't be saved. Nothing was changed." };
  }

  const changeSet = (await store.getChangeSet(stored.id).catch(() => null)) ?? {
    ...stored,
    status: "confirmed",
    action_id: actionId,
    applied_at: new Date().toISOString(),
  };
  console.log("[pipeline] applyChangeSet:", stored.id, "steps:", steps.length, "| duplicates skipped:", skippedTitles.length);
  return {
    ok: true,
    changeSet,
    actionId,
    createdTaskIds,
    createdPlanIds,
    skipped_duplicates: { count: skippedTitles.length, titles: skippedTitles },
  };
}

function refused(status: ChangeSet["status"]): ApplyResult {
  switch (status) {
    case "discarded":
      return { ok: false, reason: "discarded", message: "That change was discarded." };
    case "undone":
      return { ok: false, reason: "undone", message: "That change was already undone." };
    default:
      return { ok: false, reason: "already_confirmed", message: "Those changes were already made." };
  }
}
