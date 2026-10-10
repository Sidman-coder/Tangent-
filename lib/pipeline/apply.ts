// Pipeline V2: applies a confirmed ChangeSet to the student's calendar.
//
// The logic lives in apply-core.ts (no server-only imports, so it is unit
// tested); this file wires in the real store. Called by
// app/api/changesets/[id]/confirm when the student confirms a preview.

import "server-only";
import {
  addPlanWithTasks,
  addTask,
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
import type { ChangeSet } from "./changeset";

export type { ApplyResult } from "./apply-core";

const store: ApplyStore = {
  addPlanWithTasks,
  addTask,
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
export function applyChangeSet(input: ChangeSet): Promise<ApplyResult> {
  return applyChangeSetWith(store, input);
}
