// Run with `npm test`. Round 5A, 1.6: the server steps of a bulk action.
//   - proposeBulk builds the card and parks it, changing nothing
//   - runBulkConfirm deletes / moves / marks done and records an undo entry
//   - "delete all my chats" deletes chats, and has no undo
//   - a bulk command never reaches planning (no plan or grill dependency is touched)
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

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

const TODAY = "2026-11-13";
const task = (id: string, date: string, extra: Record<string, unknown> = {}) => ({ id, title: `t${id}`, date, time: "09:00", completed: false, planId: null, commitment: null, ...extra }) as unknown as import("../types").Task;

void (Promise.all([import("./bulk-action-run"), import("./bulk-action")]) as Promise<[typeof import("./bulk-action-run"), typeof import("./bulk-action")]>).then(([run, parse]) => {
  function fakes(tasks: ReturnType<typeof task>[], plans: { id: string; title: string }[], chats = 0) {
    const log = { deleted: [] as string[], plansDeleted: [] as string[], chatsDeleted: 0, updates: [] as [string, Record<string, unknown>][], records: [] as { kind: string; summary: string; snapshot: Record<string, unknown> }[], pending: [] as { kind: string; message: string; payload: Record<string, unknown> }[] };
    const deps = {
      getAllTasks: async () => tasks,
      getAllPlans: async () => plans as never,
      countChatSessions: async () => chats,
      addPendingConfirmation: async (kind: string, message: string, payload: Record<string, unknown>) => {
        log.pending.push({ kind, message, payload });
        return { id: "pc1", kind, message };
      },
      deleteTasks: async (ids: string[]) => (log.deleted.push(...ids), ids.length),
      deleteEmptiedPlans: async (ids: readonly string[]) => {
        log.plansDeleted.push(...ids);
        return plans.filter((p) => ids.includes(p.id)) as never;
      },
      deleteAllChats: async () => ((log.chatsDeleted = chats), chats),
      updateTask: async (id: string, patch: Record<string, unknown>) => (log.updates.push([id, patch]), null),
      recordAction: async (kind: string, summary: string, snapshot: Record<string, unknown>) => (log.records.push({ kind, summary, snapshot }), { id: `rec${log.records.length}` } as never),
    };
    return { deps, log };
  }
  const act = (text: string) => {
    const a = parse.parseBulkAction(text);
    assert.ok(a, text);
    return a;
  };

  test("1.6 'delete all my tasks and projects' proposes a card with counts and changes nothing", async () => {
    const { deps, log } = fakes([task("a", TODAY, { planId: "p1" }), task("b", TODAY)], [{ id: "p1", title: "SAT" }, { id: "p2", title: "Other" }]);
    const reply = await run.proposeBulk(act("delete all my tasks and projects"), TODAY, deps);
    assert.equal(reply.action, "confirm_required");
    assert.equal(reply.response, "Delete 2 tasks and 2 projects? You can undo this.");
    assert.deepEqual(reply.pending, { id: "pc1", kind: "delete_task", message: "Delete 2 tasks and 2 projects? You can undo this." });
    assert.equal(log.pending[0].payload.bulk, true);
    assert.deepEqual(log.deleted, []);
    assert.deepEqual(log.plansDeleted, []);
  });

  test("1.6 confirming deletes tasks and projects and records an undo entry with both", async () => {
    const tasks = [task("a", TODAY, { planId: "p1" }), task("b", TODAY)];
    const { deps, log } = fakes(tasks, [{ id: "p1", title: "SAT" }]);
    const reply = await run.proposeBulk(act("delete all my tasks and projects"), TODAY, deps);
    assert.equal(reply.action, "confirm_required");
    const res = await run.runBulkConfirm(log.pending[0].payload as never, deps);
    assert.equal(res.ok, true);
    assert.deepEqual(log.deleted.sort(), ["a", "b"]);
    assert.deepEqual(log.plansDeleted, ["p1"]);
    assert.equal(log.records.length, 1);
    assert.equal(log.records[0].kind, "delete_task");
    assert.equal((log.records[0].snapshot.removedTasks as unknown[]).length, 2);
    assert.equal((log.records[0].snapshot.removedPlans as unknown[]).length, 1);
    assert.equal(res.ok && res.actionId, "rec1");
  });

  test("1.6 'delete all my chats' deletes chats, with no undo record", async () => {
    const { deps, log } = fakes([task("a", TODAY)], [], 6);
    const reply = await run.proposeBulk(act("delete all my chats"), TODAY, deps);
    assert.equal(reply.response, "Delete 6 chats? This can't be undone.");
    const res = await run.runBulkConfirm(log.pending[0].payload as never, deps);
    assert.equal(res.ok, true);
    assert.equal(log.chatsDeleted, 6);
    assert.deepEqual(log.deleted, [], "tasks are untouched");
    assert.equal(log.records.length, 0, "chats can't be undone, so no action record");
    assert.equal(res.ok && res.response, "Deleted 6 chats.");
  });

  test("1.6 with no chats, deleting chats says so and proposes nothing", async () => {
    const { deps, log } = fakes([], [], 0);
    const reply = await run.proposeBulk(act("clear my chat history"), TODAY, deps);
    assert.equal(reply.action, "chat_reply");
    assert.match(String(reply.message), /don't have any chats/);
    assert.equal(log.pending.length, 0);
  });

  test("1.6 move all today's tasks to tomorrow: moves open tasks, undo restores date and time", async () => {
    const tasks = [task("a", TODAY, { time: "10:30" }), task("b", TODAY, { completed: true }), task("c", "2026-11-20")];
    const { deps, log } = fakes(tasks, []);
    const reply = await run.proposeBulk(act("move all today's tasks to tomorrow"), TODAY, deps);
    assert.equal(reply.action, "confirm_required");
    assert.equal(log.pending[0].kind, "reschedule_task");
    const res = await run.runBulkConfirm(log.pending[0].payload as never, deps);
    assert.equal(res.ok, true);
    assert.deepEqual(log.updates, [["a", { date: "2026-11-14" }]]);
    assert.deepEqual(log.records[0].snapshot.rescheduledMany, [{ taskId: "a", fromDate: TODAY, fromTime: "10:30" }]);
  });

  test("1.6 mark all done: completes open tasks, undo puts completed back to false", async () => {
    const tasks = [task("a", TODAY), task("b", TODAY, { completed: true })];
    const { deps, log } = fakes(tasks, []);
    await run.proposeBulk(act("mark all done"), TODAY, deps);
    assert.equal(log.pending[0].kind, "complete_task");
    const res = await run.runBulkConfirm(log.pending[0].payload as never, deps);
    assert.equal(res.ok, true);
    assert.deepEqual(log.updates, [["a", { completed: true }]]);
    assert.deepEqual(log.records[0].snapshot.restoredFields, [{ taskId: "a", fields: { completed: false } }]);
  });

  test("1.6 a confirmation for tasks that are already gone is refused, not silently 'done'", async () => {
    const { deps, log } = fakes([task("a", TODAY)], [{ id: "p1", title: "SAT" }]);
    await run.proposeBulk(act("delete all my tasks"), TODAY, deps);
    const later = fakes([], []);
    const res = await run.runBulkConfirm(log.pending[0].payload as never, later.deps);
    assert.equal(res.ok, false);
    assert.equal(later.log.records.length, 0);
  });

  test("1.6 isBulkPayload tells a bulk confirmation from an older single-task one", () => {
    assert.equal(run.isBulkPayload({ bulk: true, op: "delete", taskIds: [] }), true);
    assert.equal(run.isBulkPayload({ taskIds: ["a"], planIds: [] }), false);
    assert.equal(run.isBulkPayload({ taskId: "a" }), false);
  });
});
