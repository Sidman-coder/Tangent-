// Run with `npm test`. Rollback paths of applyChangeSetWith against an
// in-memory store, so no database is needed.
import * as nodeModule from "node:module";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActionRecord, Plan, Task } from "../types";
import type { ApplyStore } from "./apply-core";
import type { ChangeSet } from "./changeset";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

type Mod = typeof import("./apply-core");

/** A tiny in-memory store with the same contracts apply-core relies on. */
function memoryStore(cs: ChangeSet, fail: { linkUpdate?: boolean; finalMark?: boolean } = {}) {
  const db = {
    tasks: new Map<string, Task>(),
    plans: new Map<string, Plan>(),
    actions: new Map<string, ActionRecord>(),
    changeSet: { ...cs },
  };
  const store: ApplyStore = {
    async getChangeSet(id) {
      return id === db.changeSet.id ? { ...db.changeSet } : null;
    },
    async markChangeSet(id, status, opts = {}) {
      if (id !== db.changeSet.id) return false;
      const from = opts.from === undefined ? undefined : Array.isArray(opts.from) ? opts.from : [opts.from];
      if (from && !from.includes(db.changeSet.status)) return false;
      if (fail.finalMark && opts.applied) throw new Error("simulated: final change_sets update failed");
      const next = { ...db.changeSet, status };
      if (status === "draft") Object.assign(next, { confirmed_at: null, action_id: null, applied_at: null });
      if (opts.actionId !== undefined) next.action_id = opts.actionId;
      if (opts.applied) next.applied_at = new Date().toISOString();
      db.changeSet = next;
      return true;
    },
    async getAllTasks() {
      return [...db.tasks.values()];
    },
    async getAllPlans() {
      return [...db.plans.values()];
    },
    async addPlanWithTasks(plan, tasks, hooks = {}) {
      const created: Plan = { id: randomUUID(), title: plan.title, description: plan.description ?? "", taskIds: [], taskCount: 0, color: "", createdAt: "" };
      db.plans.set(created.id, created);
      hooks.onPlanCreated?.(created.id);
      const inserted = tasks.map((t) => ({ ...t, id: randomUUID(), planId: created.id }));
      for (const t of inserted) db.tasks.set(t.id, t);
      hooks.onTasksInserted?.(inserted);
      if (fail.linkUpdate) throw new Error("simulated: plan task-list update failed");
      created.taskIds = inserted.map((t) => t.id);
      created.taskCount = inserted.length;
      return { plan: created, tasks: inserted, skippedDuplicates: 0 };
    },
    async addTask(task) {
      const dup = [...db.tasks.values()].find((t) => t.title === task.title && t.date === task.date && !t.completed);
      if (dup) return { ...dup, wasDuplicate: true };
      const t = { ...task, id: randomUUID() };
      db.tasks.set(t.id, t);
      return t;
    },
    async deleteTask(id) {
      return db.tasks.delete(id);
    },
    async updateTask(id, patch) {
      const t = db.tasks.get(id);
      if (!t) return null;
      const next = { ...t, ...patch } as Task;
      db.tasks.set(id, next);
      return next;
    },
    async updatePlan(id, patch) {
      const p = db.plans.get(id);
      if (!p) return null;
      const next = { ...p, ...patch };
      db.plans.set(id, next);
      return next;
    },
    async recordAction(kind, summary, snapshot, undoable = true) {
      const r: ActionRecord = { id: randomUUID(), kind, summary, snapshot, undoable, undone: false, createdAt: "" };
      db.actions.set(r.id, r);
      return r;
    },
    async retireAction(id) {
      db.actions.delete(id);
    },
    async undoBatchSteps(steps) {
      for (const step of [...steps].reverse()) {
        if (step.type === "delete_tasks") for (const id of step.taskIds) db.tasks.delete(id);
        if (step.type === "delete_plan") db.plans.delete(step.planId);
      }
    },
  };
  return { db, store };
}

void (import("./apply-core") as Promise<Mod>).then(({ applyChangeSetWith }) => {
  const USER = "00000000-0000-4000-8000-000000000001";

  function draft(ops: unknown[]): ChangeSet {
    return {
      id: randomUUID(),
      user_id: USER,
      source: "typed",
      request_text: "make me an SAT plan",
      summary: "New plan: SAT Prep",
      intent: "new_plan",
      target_plan_id: null,
      ops,
      assumptions: [],
      status: "draft",
      created_at: "2026-10-05T14:00:00.000Z",
      confirmed_at: null,
      action_id: null,
      applied_at: null,
    } as ChangeSet;
  }

  const planDraft = () =>
    draft([
      { op: "create_plan", ref: "p1", title: "SAT Prep" },
      { op: "add_task", title: "Practice test 1", date: "2026-10-07", time: "16:00", plan_ref: "p1" },
      { op: "add_task", title: "Practice test 2", date: "2026-10-09", time: "16:00", plan_ref: "p1" },
    ]);

  test("a confirm writes one undo entry and stamps applied_at", async () => {
    const cs = planDraft();
    const { db, store } = memoryStore(cs);
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, true);
    assert.equal(db.plans.size, 1);
    assert.equal(db.tasks.size, 2);
    assert.equal(db.actions.size, 1);
    assert.equal(db.changeSet.status, "confirmed");
    assert.ok(db.changeSet.action_id);
    assert.ok(db.changeSet.applied_at);
  });

  test("if the plan's task-list update fails, the new plan and tasks are rolled back and the draft returns", async () => {
    const cs = planDraft();
    const { db, store } = memoryStore(cs, { linkUpdate: true });
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, "failed");
    assert.equal(db.plans.size, 0, "no plan left on the calendar");
    assert.equal(db.tasks.size, 0, "no tasks left on the calendar");
    assert.equal(db.actions.size, 0);
    assert.equal(db.changeSet.status, "draft");
  });

  test("if a step after the undo entry fails, the entry is removed so no stray Undo survives", async () => {
    const cs = planDraft();
    const { db, store } = memoryStore(cs, { finalMark: true });
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, false);
    assert.equal(db.actions.size, 0, "the apply_changeset record was removed");
    assert.equal(db.tasks.size, 0);
    assert.equal(db.plans.size, 0);
    assert.equal(db.changeSet.status, "draft");
    assert.equal(db.changeSet.action_id, null);
  });

  test("a confirm that creates nothing still stamps applied_at, with no undo entry", async () => {
    const cs = draft([{ op: "add_task", title: "Chem lab", date: "2026-10-07", time: "16:00" }]);
    cs.intent = "add_task";
    cs.summary = "Add Chem lab";
    const { db, store } = memoryStore(cs);
    db.tasks.set("existing", { id: "existing", title: "Chem lab", date: "2026-10-07", time: "16:00", completed: false });
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.actionId, null);
    assert.equal(r.ok && r.skipped_duplicates.count, 1);
    assert.equal(db.actions.size, 0);
    assert.equal(db.changeSet.status, "confirmed");
    assert.ok(db.changeSet.applied_at, "a second confirm can answer right away");
  });

  test("a second confirm is refused as already confirmed", async () => {
    const cs = planDraft();
    const { db, store } = memoryStore(cs);
    await applyChangeSetWith(store, cs);
    const again = await applyChangeSetWith(store, cs);
    assert.equal(again.ok === false && again.reason, "already_confirmed");
    assert.equal(db.tasks.size, 2);
  });
});
