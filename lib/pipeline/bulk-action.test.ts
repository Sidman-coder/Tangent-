// Run with `npm test`. Round 5A, 1.6: bulk actions are not planning.
//   - each phrase parses to the right action
//   - things with a topic in them ("my SAT tasks") are NOT bulk actions
//   - the card text carries exact counts
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

// 2026-11-13 is a Friday.
const TODAY = "2026-11-13";
const task = (id: string, date: string, extra: Record<string, unknown> = {}) => ({ id, title: `t${id}`, date, time: "09:00", completed: false, planId: null, commitment: null, ...extra });

void (import("./bulk-action") as Promise<typeof import("./bulk-action")>).then(({ parseBulkAction, planBulk }) => {
  test("1.6 delete phrases: tasks, projects, chats, everything", () => {
    const d = (targets: string[], scope = "all") => ({ kind: "delete", targets, scope });
    assert.deepEqual(parseBulkAction("delete all my tasks and projects"), d(["tasks", "projects"]));
    assert.deepEqual(parseBulkAction("Delete all my tasks and projects."), d(["tasks", "projects"]));
    assert.deepEqual(parseBulkAction("please delete all of my projects"), d(["projects"]));
    assert.deepEqual(parseBulkAction("delete all my chats"), d(["chats"]));
    assert.deepEqual(parseBulkAction("clear my chat history"), d(["chats"]));
    assert.deepEqual(parseBulkAction("delete all my conversations"), d(["chats"]));
    assert.deepEqual(parseBulkAction("delete everything"), d(["tasks", "projects"]));
    assert.deepEqual(parseBulkAction("clear everything"), d(["tasks", "projects"]));
    assert.deepEqual(parseBulkAction("clear my schedule"), d(["tasks"]));
    assert.deepEqual(parseBulkAction("remove all my tasks"), d(["tasks"]));
    assert.deepEqual(parseBulkAction("wipe my tasks, projects and chats"), d(["tasks", "projects", "chats"]));
    assert.deepEqual(parseBulkAction("delete today's tasks"), d(["tasks"], "today"));
    assert.deepEqual(parseBulkAction("clear all overdue tasks"), d(["tasks"], "overdue"));
    assert.deepEqual(parseBulkAction("delete this week's tasks"), d(["tasks"], "week"));
  });

  test("1.6 move all and mark all done", () => {
    assert.deepEqual(parseBulkAction("move all today's tasks to tomorrow"), { kind: "move", scope: "today", to: { kind: "tomorrow" } });
    assert.deepEqual(parseBulkAction("push everything to next week"), { kind: "move", scope: "all", to: { kind: "next_week" } });
    assert.deepEqual(parseBulkAction("move all overdue tasks to today"), { kind: "move", scope: "overdue", to: { kind: "today" } });
    assert.deepEqual(parseBulkAction("reschedule all my tasks to monday"), { kind: "move", scope: "all", to: { kind: "weekday", day: 1 } });
    assert.deepEqual(parseBulkAction("mark all done"), { kind: "done", scope: "all" });
    assert.deepEqual(parseBulkAction("mark everything as done"), { kind: "done", scope: "all" });
    assert.deepEqual(parseBulkAction("mark all of today's tasks as done"), { kind: "done", scope: "today" });
    assert.deepEqual(parseBulkAction("complete all my tasks"), { kind: "done", scope: "all" });
    assert.deepEqual(parseBulkAction("check off all tasks"), { kind: "done", scope: "all" });
  });

  test("1.6 a topic, one task or a plan request is not a bulk action", () => {
    for (const s of [
      "delete my SAT tasks",
      "delete all my chem tasks",
      "delete the chem project",
      "delete",
      "delete it",
      "clear today's projects",
      "move chem to friday",
      "move my essay to tomorrow",
      "mark chem done",
      "mark done",
      "finish my essay",
      "help me get better at chess",
      "plan my week",
      "what should I delete",
      "how do I clear my head",
    ]) {
      assert.equal(parseBulkAction(s), null, s);
    }
  });

  test("1.6 the card says exactly what will go", () => {
    const tasks = [task("a", TODAY, { planId: "p1" }), task("b", TODAY), task("c", "2026-11-20", { planId: "p1" })];
    const plans = [{ id: "p1", title: "SAT" }, { id: "p2", title: "Empty one" }];
    const all = planBulk({ kind: "delete", targets: ["tasks", "projects"], scope: "all" }, { tasks, plans, chatCount: 0, today: TODAY });
    assert.equal(all.kind, "confirm");
    if (all.kind !== "confirm") return;
    assert.equal(all.message, "Delete 3 tasks and 2 projects? You can undo this.");
    assert.deepEqual(all.planIds, ["p1", "p2"], "a project with no tasks goes too");
    assert.equal(all.taskIds.length, 3);
    assert.equal(all.undoable, true);

    // Tasks only: a project left with no steps goes with them (A2); one that still has steps stays.
    const t = planBulk({ kind: "delete", targets: ["tasks"], scope: "today" }, { tasks, plans, chatCount: 0, today: TODAY });
    assert.ok(t.kind === "confirm");
    if (t.kind === "confirm") {
      assert.deepEqual(t.taskIds, ["a", "b"]);
      assert.deepEqual(t.planIds, [], "p1 still has a step on the 20th");
      assert.equal(t.message, "Delete 2 tasks from today? You can undo this.");
    }

    const projects = planBulk({ kind: "delete", targets: ["projects"], scope: "all" }, { tasks, plans, chatCount: 0, today: TODAY });
    assert.ok(projects.kind === "confirm");
    if (projects.kind === "confirm") {
      assert.equal(projects.message, "Delete 2 projects and their 2 steps? You can undo this.");
      assert.deepEqual(projects.taskIds.sort(), ["a", "c"]);
    }
  });

  test("1.6 chats: exact count, and the card says it can't be undone", () => {
    const chats = planBulk({ kind: "delete", targets: ["chats"], scope: "all" }, { tasks: [], plans: [], chatCount: 6, today: TODAY });
    assert.ok(chats.kind === "confirm");
    if (chats.kind === "confirm") {
      assert.equal(chats.message, "Delete 6 chats? This can't be undone.");
      assert.equal(chats.chats, true);
      assert.equal(chats.undoable, false);
    }
    const mixed = planBulk({ kind: "delete", targets: ["tasks", "chats"], scope: "all" }, { tasks: [task("a", TODAY)], plans: [], chatCount: 2, today: TODAY });
    assert.ok(mixed.kind === "confirm");
    if (mixed.kind === "confirm") assert.match(mixed.message, /^Delete 1 task and 2 chats\? Undo brings the tasks and projects back, but not the chats\.$/);
    const none = planBulk({ kind: "delete", targets: ["chats"], scope: "all" }, { tasks: [], plans: [], chatCount: 0, today: TODAY });
    assert.equal(none.kind, "empty");
  });

  test("1.6 move all: open tasks only, fixed events stay, dates are exact", () => {
    const tasks = [
      task("a", TODAY),
      task("b", TODAY, { completed: true }),
      task("c", TODAY, { commitment: "fixed" }),
      task("d", "2026-11-10"),
    ];
    const r = planBulk({ kind: "move", scope: "today", to: { kind: "tomorrow" } }, { tasks, plans: [], chatCount: 0, today: TODAY });
    assert.ok(r.kind === "confirm");
    if (r.kind === "confirm") {
      assert.deepEqual(r.moves, [{ taskId: "a", date: "2026-11-14" }]);
      assert.equal(r.message, "Move 1 task from today to tomorrow? 1 fixed event stays put. You can undo this.");
    }
    const overdue = planBulk({ kind: "move", scope: "overdue", to: { kind: "today" } }, { tasks, plans: [], chatCount: 0, today: TODAY });
    assert.ok(overdue.kind === "confirm");
    if (overdue.kind === "confirm") assert.deepEqual(overdue.moves, [{ taskId: "d", date: TODAY }]);
    const monday = planBulk({ kind: "move", scope: "today", to: { kind: "weekday", day: 1 } }, { tasks, plans: [], chatCount: 0, today: TODAY });
    assert.ok(monday.kind === "confirm");
    if (monday.kind === "confirm") assert.equal(monday.moves[0].date, "2026-11-16");
    const nextWeek = planBulk({ kind: "move", scope: "today", to: { kind: "next_week" } }, { tasks, plans: [], chatCount: 0, today: TODAY });
    assert.ok(nextWeek.kind === "confirm");
    if (nextWeek.kind === "confirm") assert.equal(nextWeek.moves[0].date, "2026-11-20");
  });

  test("1.6 mark all done: counts the open ones; nothing to do says so", () => {
    const tasks = [task("a", TODAY), task("b", TODAY, { completed: true }), task("c", "2026-11-20")];
    const r = planBulk({ kind: "done", scope: "today" }, { tasks, plans: [], chatCount: 0, today: TODAY });
    assert.ok(r.kind === "confirm");
    if (r.kind === "confirm") {
      assert.equal(r.message, "Mark 1 task from today as done? You can undo this.");
      assert.deepEqual(r.taskIds, ["a"]);
    }
    assert.equal(planBulk({ kind: "done", scope: "all" }, { tasks: [], plans: [], chatCount: 0, today: TODAY }).kind, "empty");
  });
});
