// Run with `npm test`.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../../${specifier.slice(2)}`, import.meta.url).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});
type Mod = typeof import("./plan-shift");
void (import("./plan-shift") as Promise<Mod>).then(({ parsePlanShift, planShiftOps }) => {
  test("push/move/shift a plan back or forward by days and weeks", () => {
    assert.equal(parsePlanShift("push my ICF checkpoints back two days"), 2);
    assert.equal(parsePlanShift("move my SAT plan back a day"), 1);
    assert.equal(parsePlanShift("shift the essay plan forward 3 days"), -3);
    assert.equal(parsePlanShift("push everything in ICF prep back a week"), 7);
    assert.equal(parsePlanShift("push my bio plan back by 2 weeks"), 14);
    assert.equal(parsePlanShift("move my chem prep 1 day earlier"), -1);
    assert.equal(parsePlanShift("delay my ICF prep by three days"), 3);
    assert.equal(parsePlanShift("postpone my robotics plan 4 days"), 4);
  });

  test("anything that isn't a clear shift is null (the model handles it)", () => {
    assert.equal(parsePlanShift("rename my ICF plan to ICF Finals"), null);
    assert.equal(parsePlanShift("push my ICF checkpoints to friday"), null);
    assert.equal(parsePlanShift("add 2 checkpoints to my ICF prep"), null);
    assert.equal(parsePlanShift("push back"), null);
    assert.equal(parsePlanShift("push my plan back 90 days"), null);
  });

  test("moves only open steps from today on, keeping their times", () => {
    const tasks = [
      { id: "a", date: "2026-11-20", time: "18:00", completed: false },
      { id: "b", date: "2026-11-24", time: "18:00", completed: false },
      { id: "c", date: "2026-11-26", completed: true },
      { id: "d", date: "2026-11-27", time: "", completed: false },
    ];
    assert.deepEqual(planShiftOps(tasks, 2, "2026-11-22"), [
      { op: "move_task", task_id: "b", date: "2026-11-26", time: "18:00" },
      { op: "move_task", task_id: "d", date: "2026-11-29" },
    ]);
  });

  test("never moves a step into the past", () => {
    const tasks = [{ id: "b", date: "2026-11-23", time: "09:00", completed: false }];
    assert.deepEqual(planShiftOps(tasks, -3, "2026-11-22"), [{ op: "move_task", task_id: "b", date: "2026-11-22", time: "09:00" }]);
  });
});
