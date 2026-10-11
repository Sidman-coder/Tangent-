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

/** The undo side of the in-memory store, with lib/store.ts's contracts:
 *  restored tasks keep their plan link only while that plan exists. */
function memoryUndoStore(db: { tasks: Map<string, Task>; plans: Map<string, Plan> }) {
  return {
    async getTasksByIds(ids: string[]) {
      return ids.map((id) => db.tasks.get(id)).filter((t): t is Task => !!t);
    },
    async getPlan(id: string) {
      return db.plans.get(id) ?? null;
    },
    async deleteTasks(ids: string[]) {
      for (const id of ids) db.tasks.delete(id);
    },
    async deletePlan(id: string) {
      return db.plans.delete(id);
    },
    async restoreTasks(tasks: Task[]) {
      for (const t of tasks) if (!db.tasks.has(t.id)) db.tasks.set(t.id, { ...t, planId: t.planId && db.plans.has(t.planId) ? t.planId : null });
    },
    async restorePlan(plan: Plan) {
      db.plans.set(plan.id, { ...plan, taskIds: [...plan.taskIds] });
    },
    async updateTask(id: string, patch: Partial<Omit<Task, "id">>) {
      const t = db.tasks.get(id);
      if (!t) return null;
      const next = { ...t, ...patch } as Task;
      db.tasks.set(id, next);
      return next;
    },
    async updatePlan(id: string, patch: Partial<Plan>) {
      const p = db.plans.get(id);
      if (!p) return null;
      const next = { ...p, ...patch };
      db.plans.set(id, next);
      return next;
    },
  };
}

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
      return Array.from(db.tasks.values());
    },
    async getAllPlans() {
      return Array.from(db.plans.values());
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
      const dup = Array.from(db.tasks.values()).find((t) => t.title === task.title && t.date === task.date && !t.completed);
      if (dup) return { ...dup, wasDuplicate: true };
      const t = { ...task, id: randomUUID() };
      db.tasks.set(t.id, t);
      return t;
    },
    async deleteTask(id) {
      return db.tasks.delete(id);
    },
    async deletePlan(id) {
      // tasks.plan_id → plans on delete set null
      for (const t of Array.from(db.tasks.values())) if (t.planId === id) db.tasks.set(t.id, { ...t, planId: null });
      return db.plans.delete(id);
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
      const { undoStepsWith } = (await import("./undo-core")) as typeof import("./undo-core");
      await undoStepsWith(memoryUndoStore(db), steps);
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

  // ─── Compare-and-restore undo (A5) and plan removal (A2) ──────────────────

  const P = "11111111-1111-4111-8111-111111111111";
  const T1 = "22222222-2222-4222-8222-222222222221";
  const T2 = "22222222-2222-4222-8222-222222222222";
  const T3 = "22222222-2222-4222-8222-222222222223";
  const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: `Task ${id.slice(-1)}`, date: "2026-10-07", time: "16:00", completed: false, planId: P, ...extra });
  const seedPlan = (db: ReturnType<typeof memoryStore>["db"], ids: string[]) => {
    db.plans.set(P, { id: P, title: "SAT Prep", description: "Get to 1500", taskIds: [...ids], taskCount: ids.length, color: "#7c3aed", createdAt: "2026-10-01T00:00:00.000Z" });
    for (const id of ids) db.tasks.set(id, task(id));
  };
  async function undo(db: ReturnType<typeof memoryStore>["db"], store: ApplyStore) {
    const record = Array.from(db.actions.values())[0];
    assert.ok(record?.snapshot.batch, "an undo entry was written");
    await store.undoBatchSteps(record.snapshot.batch.steps);
  }

  test("undo of a move leaves a date the student changed afterwards", async () => {
    const cs = draft([{ op: "move_task", task_id: T1, date: "2026-10-09", time: "17:00" }]);
    cs.intent = "change_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1]);
    await applyChangeSetWith(store, cs);
    db.tasks.set(T1, { ...db.tasks.get(T1)!, date: "2026-10-12" }); // the student moves it again
    await undo(db, store);
    assert.equal(db.tasks.get(T1)!.date, "2026-10-12", "the student's later date is kept");
    assert.equal(db.tasks.get(T1)!.time, "16:00", "the time still held what the change wrote, so it goes back");
  });

  test("undo of a move with no later edits restores both fields", async () => {
    const cs = draft([{ op: "move_task", task_id: T1, date: "2026-10-09", time: "17:00" }]);
    cs.intent = "change_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1]);
    await applyChangeSetWith(store, cs);
    await undo(db, store);
    assert.equal(db.tasks.get(T1)!.date, "2026-10-07");
    assert.equal(db.tasks.get(T1)!.time, "16:00");
  });

  test("undo of a complete leaves a task the student un-completed and re-completed alone only if still done", async () => {
    const cs = draft([{ op: "complete_task", task_id: T1 }]);
    cs.intent = "complete_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1]);
    await applyChangeSetWith(store, cs);
    db.tasks.set(T1, { ...db.tasks.get(T1)!, completed: false, title: "Renamed by me" });
    await undo(db, store);
    assert.equal(db.tasks.get(T1)!.completed, false);
    assert.equal(db.tasks.get(T1)!.title, "Renamed by me");
  });

  test("undo of a rename keeps a newer rename, and removes only the tasks the change added to the plan", async () => {
    const cs = draft([
      { op: "update_plan", plan_id: P, title: "SAT Sprint" },
      { op: "add_task", title: "Practice test 3", date: "2026-10-11", time: "16:00", plan_id: P },
    ]);
    cs.intent = "add_to_plan";
    cs.target_plan_id = P;
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1]);
    await applyChangeSetWith(store, cs);
    const added = db.plans.get(P)!.taskIds.find((id) => id !== T1)!;
    // Afterwards the student renames the plan and adds a task of their own.
    db.tasks.set(T2, task(T2));
    db.plans.set(P, { ...db.plans.get(P)!, title: "My SAT plan", taskIds: [...db.plans.get(P)!.taskIds, T2], taskCount: 3 });
    await undo(db, store);
    const plan = db.plans.get(P)!;
    assert.equal(plan.title, "My SAT plan", "the student's rename is kept");
    assert.deepEqual(plan.taskIds, [T1, T2], "only the added task leaves the list");
    assert.equal(plan.taskCount, 2);
    assert.equal(db.tasks.has(added), false);
  });

  test("undo of a rename with no later edits puts the old title back", async () => {
    const cs = draft([{ op: "update_plan", plan_id: P, title: "SAT Sprint" }]);
    cs.intent = "change_plan";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1]);
    await applyChangeSetWith(store, cs);
    assert.equal(db.plans.get(P)!.title, "SAT Sprint");
    await undo(db, store);
    assert.equal(db.plans.get(P)!.title, "SAT Prep");
  });

  test("delete_plan with all its tasks: undo restores the plan and relinks every task", async () => {
    const cs = draft([
      { op: "delete_task", task_id: T1 },
      { op: "delete_task", task_id: T2 },
      { op: "delete_plan", plan_id: P },
    ]);
    cs.intent = "delete_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1, T2]);
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, true);
    assert.equal(db.plans.size, 0);
    assert.equal(db.tasks.size, 0);
    await undo(db, store);
    assert.equal(db.plans.get(P)?.title, "SAT Prep");
    assert.deepEqual(db.plans.get(P)?.taskIds, [T1, T2]);
    assert.equal(db.tasks.get(T1)?.planId, P);
    assert.equal(db.tasks.get(T2)?.planId, P);
  });

  test("delete_plan listed before its task deletes still relinks on undo", async () => {
    const cs = draft([
      { op: "delete_plan", plan_id: P },
      { op: "delete_task", task_id: T1 },
    ]);
    cs.intent = "delete_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1, T2]);
    await applyChangeSetWith(store, cs);
    assert.equal(db.tasks.get(T2)?.planId, null, "a kept task is unlinked when its plan goes");
    await undo(db, store);
    assert.equal(db.tasks.get(T1)?.planId, P);
    assert.equal(db.tasks.get(T2)?.planId, P, "the kept task is relinked");
  });

  test("delete_plan undo leaves a kept task the student moved to another plan", async () => {
    const OTHER = "33333333-3333-4333-8333-333333333333";
    const cs = draft([{ op: "delete_task", task_id: T1 }, { op: "delete_plan", plan_id: P }]);
    cs.intent = "delete_task";
    const { db, store } = memoryStore(cs);
    seedPlan(db, [T1, T3]);
    db.plans.set(OTHER, { id: OTHER, title: "Essays", description: "", taskIds: [], taskCount: 0, color: "", createdAt: "" });
    await applyChangeSetWith(store, cs);
    db.tasks.set(T3, { ...db.tasks.get(T3)!, planId: OTHER });
    await undo(db, store);
    assert.equal(db.tasks.get(T3)?.planId, OTHER);
    assert.equal(db.tasks.get(T1)?.planId, P);
  });
});
