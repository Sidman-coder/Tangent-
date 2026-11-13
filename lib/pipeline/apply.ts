// Pipeline V2: applies a confirmed ChangeSet to the student's calendar.
//
// The logic lives in apply-core.ts (no server-only imports, so it is unit
// tested); this file wires in the real store. Called by
// app/api/changesets/[id]/confirm when the student confirms a preview.

import "server-only";
import {
  addPlanWithTasks,
  addRecurringTask,
  addTask,
  deletePlan,
  deleteTask,
  getAllPlans,
  getAllTasks,
  getChangeSet,
  markChangeSet,
  recordAction,
  retireAction,
  undoBatchSteps,
  updatePlan,
  updateTask,
} from "../store";
import { applyChangeSetWith, type ApplyResult, type ApplyStore } from "./apply-core";
import { logStepEvents } from "@/lib/student/step-events";
import type { ChangeSet } from "./changeset";

export type { ApplyResult } from "./apply-core";

const store: ApplyStore = {
  addPlanWithTasks,
  addRecurringTask,
  addTask,
  deletePlan,
  deleteTask,
  getAllPlans,
  getAllTasks,
  getChangeSet,
  markChangeSet,
  recordAction,
  retireAction,
  undoBatchSteps,
  updatePlan,
  updateTask,
};

/** See applyChangeSetWith (apply-core.ts). */
export async function applyChangeSet(input: ChangeSet): Promise<ApplyResult> {
  const result = await applyChangeSetWith(store, input);
  // The observation log (lib/student/step-events.ts): each new step, once.
  if (result.ok && result.createdTaskIds.length) {
    const ids = new Set(result.createdTaskIds);
    void getAllTasks()
      .then((all) => logStepEvents(all.filter((t) => ids.has(t.id)).map((task) => ({ kind: "created" as const, task }))))
      .catch(() => undefined);
  }
  return result;
}
