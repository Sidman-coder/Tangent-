import test from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./calendar-draft");

const one = { datesOf: (op: { date: string }) => [op.date], colorOf: () => "#7c6cf0" };

void (import("./calendar-draft.ts" as string) as Promise<Mod>).then(({ draftTasks, isDraftTask, DRAFT_TASK_PREFIX }) => {
  test("draftTasks: one stand-in task per add_task op, ids marked as drafts", () => {
    const steps = draftTasks(
      [
        { op: "create_plan", ref: "cp", title: "Competitive programming" },
        { op: "add_task", title: "Solve 3 easy problems", date: "2026-11-16", time: "16:30", plan_ref: "cp" },
        { op: "add_task", title: "Read about binary search", date: "2026-11-18", plan_ref: "cp" },
      ] as never,
      one
    );
    assert.equal(steps.length, 2);
    assert.deepEqual(steps.map((s) => [s.title, s.date, s.time, s.draftColor]), [
      ["Solve 3 easy problems", "2026-11-16", "16:30", "#7c6cf0"],
      ["Read about binary search", "2026-11-18", "", "#7c6cf0"],
    ]);
    assert.ok(steps.every((s) => s.id.startsWith(DRAFT_TASK_PREFIX) && isDraftTask(s) && !s.completed));
    assert.equal(new Set(steps.map((s) => s.id)).size, 2);
  });

  test("draftTasks: a series lands on every date it repeats, each with its own id", () => {
    const steps = draftTasks([{ op: "add_task", title: "Practice", date: "2026-11-16", time: "17:00" }] as never, {
      datesOf: () => ["2026-11-16", "2026-11-23", "2026-11-30"],
      colorOf: () => "#000",
    });
    assert.deepEqual(steps.map((s) => s.date), ["2026-11-16", "2026-11-23", "2026-11-30"]);
    assert.equal(new Set(steps.map((s) => s.id)).size, 3);
  });

  test("isDraftTask: real task ids aren't drafts", () => {
    assert.equal(isDraftTask({ id: "6f1c0a4e-0000-4000-8000-000000000001" }), false);
  });
});
