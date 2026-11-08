// Run with `npm test`. Rollback paths of applyChangeSetWith against an
// in-memory store, so no database is needed. The master fix B7 section at the
// end runs whole flows (request → draft → preview text → confirm → undo).
import * as nodeModule from "node:module";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ActionRecord, Plan, Task } from "../types";
import type { ApplyStore } from "./apply-core";
import type { ChangeSet } from "./changeset";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(ROOT, s.slice(2))).href;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(s)) {
      try {
        return next(`${s}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(s, context);
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
    async addRecurringTask(task, recurring) {
      // Weekly only, up to endDate (or two weeks), enough for the tests.
      const out: (Task & { wasDuplicate?: boolean })[] = [];
      const end = recurring.endDate ?? new Date(Date.parse(`${task.date}T12:00:00Z`) + 13 * 86400000).toISOString().slice(0, 10);
      for (let d = new Date(`${task.date}T12:00:00Z`); d.toISOString().slice(0, 10) <= end; d = new Date(d.getTime() + 86400000)) {
        if (recurring.daysOfWeek?.length && !recurring.daysOfWeek.includes(d.getUTCDay())) continue;
        const date = d.toISOString().slice(0, 10);
        const dup = Array.from(db.tasks.values()).find((t) => t.title === task.title && t.date === date && !t.completed);
        if (dup) {
          out.push({ ...dup, wasDuplicate: true });
          continue;
        }
        const t = { ...task, date, id: randomUUID() };
        db.tasks.set(t.id, t);
        out.push(t);
      }
      return out;
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

  test("a recurring add_task creates the series, and one undo removes only what it created", async () => {
    const cs = draft([
      { op: "add_task", title: "Gym", date: "2026-10-05", time: "07:00", repeat: { frequency: "weekly", daysOfWeek: [1, 3], endDate: "2026-10-14" } },
    ]);
    cs.intent = "add_task";
    cs.summary = "Add recurring Gym";
    const { db, store } = memoryStore(cs);
    db.tasks.set("existing", { id: "existing", title: "Gym", date: "2026-10-07", time: "07:00", completed: false });
    const r = await applyChangeSetWith(store, cs);
    assert.equal(r.ok, true);
    // Mon 5, Wed 7 (already there), Mon 12, Wed 14
    assert.deepEqual(r.ok && r.createdTaskIds.length, 3);
    assert.equal(db.tasks.size, 4);
    await undo(db, store);
    assert.deepEqual(Array.from(db.tasks.keys()), ["existing"], "the student's own Gym stays");
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

  // ─── Master fix B7: end to end ─────────────────────────────────────────────
  // Each runs a whole flow through the real pure modules: what the request
  // drafts, what the preview says, what Confirm writes, and what Undo leaves.

  type DraftMod = typeof import("./draft");
  type CsMod = typeof import("./changeset");
  const mods = async () => ({
    draft: (await import("./draft")) as DraftMod,
    cs: (await import("./changeset")) as CsMod,
  });
  const TODAY = "2026-10-11";
  const build = (d: DraftMod, input: Omit<Parameters<DraftMod["buildDraft"]>[0], "id" | "userId" | "source" | "now">) => {
    const r = d.buildDraft({ id: randomUUID(), userId: "55555555-5555-4555-8555-555555555555", source: "typed", now: "2026-10-11T12:00:00.000Z", ...input });
    assert.ok(r.ok, r.ok ? "" : r.error);
    return { ...r.changeSet, applied_at: null } as ChangeSet;
  };

  test("B7 / A3 titles: the request's lead-in and when-words are gone everywhere, and the time is kept", async () => {
    const { draft: d, cs } = await mods();
    const { hasTimeWords } = (await import("../quick-add")) as typeof import("../quick-add");
    const text = "I have a soccer coaching appointment coming up tomorrow 10pm";
    assert.equal(hasTimeWords(text), true, "the said time is kept, not replaced by spacing");
    const changeSet = build(d, { requestText: text, summary: "Add a task", intent: "add_task", ops: [d.taskOp({ title: text, date: "2026-10-12", time: "22:00" })] });
    assert.equal(changeSet.summary, 'Add "Soccer coaching appointment"');
    assert.deepEqual(cs.describeChangeSet(changeSet, { today: TODAY }), ["Add 'Soccer coaching appointment' · Mon 10:00 PM"]);
    const { db, store } = memoryStore(changeSet);
    const r = await applyChangeSetWith(store, changeSet);
    assert.equal(r.ok, true);
    const saved = Array.from(db.tasks.values());
    assert.deepEqual(saved.map((t) => [t.title, t.date, t.time]), [["Soccer coaching appointment", "2026-10-12", "22:00"]]);
    // A title that is the task itself is left alone.
    assert.equal(d.taskOp({ title: "Add math notes to binder", date: TODAY }).title, "Add math notes to binder");
  });

  test("B7 / A4 Just talking → readiness: the talked-through schedule is what gets previewed and added", async () => {
    const { draft: d } = await mods();
    const talking = (await import("../../components/console/talking")) as typeof import("../../components/console/talking");
    const planText = (await import("./plan-text")) as typeof import("./plan-text");
    const SCHEDULE = "Here's your week:\nMon, Oct 12 — 4:00 PM — Outline\nWed, Oct 14 — 4:00 PM — Draft\nFri, Oct 16 — 4:00 PM — Edit";
    type T = { id: string; talking?: boolean; planReady?: boolean; planClosed?: boolean };
    // A preview, then "Just talking": the conversation is talking.
    const turns: T[] = [{ id: "t1", talking: true }];
    assert.equal(talking.talkingRoute(turns, "I'm free after 4 most days"), "chat", "the answer is talked through, not drafted");
    // The reply is a complete schedule: "Ready to add this to your calendar?".
    assert.equal(talking.isReadyReply("plan_reply", SCHEDULE), true);
    turns.push({ id: "t2", talking: true, planReady: true });
    assert.equal(talking.openPlanTurn(turns)?.id, "t2", "the Add plan chip sits on it");
    // "Yes, show preview" leaves talking and drafts exactly the lines shown.
    assert.equal(talking.talkingRoute(turns, "add this plan to my calendar"), undefined);
    assert.equal(planText.isAddShownPlan("add this plan to my calendar"), true);
    const read = planText.parsePlanText(SCHEDULE, TODAY);
    const changeSet = build(d, { requestText: "help me plan my essay", summary: "New plan", intent: "new_plan", ops: d.planOps("Essay", read.tasks) });
    assert.equal(changeSet.summary, 'New plan "Essay" with 3 tasks');
    const { db, store } = memoryStore(changeSet);
    await applyChangeSetWith(store, changeSet);
    assert.deepEqual(
      Array.from(db.tasks.values()).map((t) => [t.title, t.date, t.time]),
      [["Outline", "2026-10-12", "16:00"], ["Draft", "2026-10-14", "16:00"], ["Edit", "2026-10-16", "16:00"]]
    );
    turns[1].planClosed = true;
    assert.equal(talking.openPlanTurn(turns), null, "the chip goes once added");
  });

  test("B7 / A5 compare-and-restore: undo reverts only what this change set still holds", async () => {
    const { draft: d, cs } = await mods();
    const changeSet = build(d, {
      requestText: "move my SAT tasks to friday and rename the first",
      summary: "Change 2 tasks",
      intent: "change_task",
      ops: [
        { op: "update_task", task_id: T1, title: "Practice test", date: "2026-10-16" },
        { op: "update_task", task_id: T2, date: "2026-10-16" },
      ],
    });
    const { db, store } = memoryStore(changeSet);
    seedPlan(db, [T1, T2]);
    assert.deepEqual(cs.describeChangeSet(changeSet, { tasks: Array.from(db.tasks.values()), today: TODAY }), [
      "Change 'Task 1': rename to 'Practice test', move to Fri",
      "Change 'Task 2': move to Fri",
    ]);
    await applyChangeSetWith(store, changeSet);
    // Afterwards the student renames Task 1 again and moves Task 2 themselves.
    db.tasks.set(T1, { ...db.tasks.get(T1)!, title: "Full practice test" });
    db.tasks.set(T2, { ...db.tasks.get(T2)!, date: "2026-10-18" });
    await undo(db, store);
    assert.equal(db.tasks.get(T1)?.title, "Full practice test", "a newer rename is kept");
    assert.equal(db.tasks.get(T1)?.date, "2026-10-07", "the move this change made is undone");
    assert.equal(db.tasks.get(T2)?.date, "2026-10-18", "the student's own move is kept");
  });

  test("B7 / A6 project previews: steps added to an existing project preview, confirm into it, and undo out of it", async () => {
    const { draft: d, cs } = await mods();
    const ops = [
      d.taskOp({ title: "Timed reading section", date: "2026-10-13", time: "17:00" }, { plan_id: P }),
      d.taskOp({ title: "Review wrong answers", date: "2026-10-15", time: "17:00" }, { plan_id: P }),
    ];
    const changeSet = build(d, { requestText: "add two more sessions", summary: "Add to project", intent: "add_task", targetPlanId: P, ops });
    assert.equal(changeSet.summary, "Add to project", "a project add keeps its headline");
    const { db, store } = memoryStore(changeSet);
    seedPlan(db, [T1, T2]);
    assert.deepEqual(cs.describeChangeSet(changeSet, { plans: Array.from(db.plans.values()), today: TODAY }), [
      "Add 'Timed reading section' to 'SAT Prep' · Tue 5:00 PM",
      "Add 'Review wrong answers' to 'SAT Prep' · Thu 5:00 PM",
    ]);
    assert.equal(db.tasks.size, 2, "nothing is saved before Confirm");
    const r = await applyChangeSetWith(store, changeSet);
    assert.equal(r.ok, true);
    const plan = db.plans.get(P)!;
    assert.equal(plan.taskCount, 4);
    assert.equal(Array.from(db.tasks.values()).filter((t) => t.planId === P).length, 4);
    await undo(db, store);
    assert.deepEqual(Array.from(db.tasks.keys()).sort(), [T1, T2].sort());
    assert.deepEqual(db.plans.get(P)?.taskIds, [T1, T2], "the project keeps only its own tasks");
  });

  test("B7 / the my SAT tasks bug: the answer stays on the delete, never lists calendars, and only SAT tasks go", async () => {
    const { draft: d } = await mods();
    const pending = (await import("../pending-question")) as typeof import("../pending-question");
    const scope = (await import("../delete-scope")) as typeof import("../delete-scope");
    const READ = "33333333-3333-4333-8333-333333333331";
    const MATH = "33333333-3333-4333-8333-333333333332";
    const ids = { r1: "44444444-4444-4444-8444-444444444441", m1: "44444444-4444-4444-8444-444444444442", soccer: "44444444-4444-4444-8444-444444444443" };
    const seed: Task[] = [
      { id: ids.r1, title: "Reading passages", date: "2026-10-12", time: "16:00", completed: false, planId: READ },
      { id: ids.m1, title: "Circle theorems", date: "2026-10-13", time: "16:00", completed: false, planId: MATH },
      { id: ids.soccer, title: "Saturday soccer practice", date: "2026-10-17", time: "10:00", completed: false, planId: null },
    ];
    const plans = [
      { id: READ, title: "SAT Reading Score Boost" },
      { id: MATH, title: "SAT Math Geometry Sprint" },
    ];
    // "take out all my SAT tasks" asks which, offering only the SAT plans.
    const ask = scope.planBulkDelete("take out all my SAT tasks", seed, plans);
    assert.equal(ask?.kind, "ask");
    const candidates = ask?.kind === "ask" ? ask.candidates ?? [] : [];
    assert.deepEqual(candidates.map((c) => c.id), [READ, MATH], "Saturday soccer is not offered");
    const q = pending.makePendingQuestion("plan", candidates, "take out all my SAT tasks", new Date("2026-10-11T12:00:00Z"));
    // "my SAT tasks" is an answer: it asks again (FAST pick, then the chips), never the calendar list.
    assert.equal(pending.resolvePendingAnswer("my SAT tasks", q).kind, "unclear");
    assert.equal(pending.asksForCalendars("my SAT tasks"), false);
    // "All of these" picks both plans; the preview deletes their tasks and offers the plans.
    const picked = pending.resolvePendingAnswer("All of these", q);
    assert.equal(picked.kind, "pick");
    const chosen = new Set(picked.kind === "pick" ? picked.candidates.map((c) => c.id) : []);
    let ops: ChangeSet["ops"] = seed.filter((t) => t.planId && chosen.has(t.planId)).map((t) => ({ op: "delete_task" as const, task_id: t.id }));
    for (const id of Array.from(chosen)) {
      const e = d.editOps(ops, { type: "plan_removal", plan_id: id, remove: true });
      assert.ok(e.ok);
      if (e.ok) ops = e.ops;
    }
    const changeSet = build(d, { requestText: "take out all my SAT tasks", summary: "Delete 2 tasks", intent: "delete_task", ops });
    const { db, store } = memoryStore(changeSet);
    for (const t of seed) db.tasks.set(t.id, t);
    for (const p of plans) {
      const taskIds = seed.filter((t) => t.planId === p.id).map((t) => t.id);
      db.plans.set(p.id, { ...p, description: "", taskIds, taskCount: taskIds.length, color: "", createdAt: "" });
    }
    await applyChangeSetWith(store, changeSet);
    assert.deepEqual(Array.from(db.tasks.keys()), [ids.soccer], "only the SAT tasks are gone");
    assert.equal(db.plans.size, 0);
    await undo(db, store);
    assert.equal(db.tasks.size, 3);
    assert.equal(db.plans.size, 2);
    assert.equal(db.tasks.get(ids.r1)?.planId, READ, "tasks are relinked to their restored plans");
  });
});

test("undo snapshots carry a task's type and overdue dismissal", async () => {
  const { fieldValues } = (await import("./undo-core")) as typeof import("./undo-core");
  const base: Task = { id: "a", title: "Dentist", date: "2026-11-05", time: "15:30", completed: false };
  assert.deepEqual(fieldValues(base, ["commitment", "overdueDismissedAt"]), { commitment: null, overdueDismissedAt: null });
  const set: Task = { ...base, commitment: "fixed", overdueDismissedAt: "2026-11-05T20:00:00.000Z" };
  assert.deepEqual(fieldValues(set, ["commitment", "overdueDismissedAt"]), {
    commitment: "fixed",
    overdueDismissedAt: "2026-11-05T20:00:00.000Z",
  });
});
