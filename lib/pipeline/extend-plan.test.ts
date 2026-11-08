// Run with `npm test`. Adding to an existing plan (B4), the pure half: only
// new tasks, the student's own day and time kept, spacing's choices noted,
// add_task ops with plan_id and never create_plan.
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

type Mod = typeof import("./extend-plan-core");
type Draft = typeof import("./draft");

void Promise.all([import("./extend-plan-core") as Promise<Mod>, import("./draft") as Promise<Draft>]).then(
  ([{ readExtendOutput, targetDates, applyPlacements, extendOps, extendHeader, spacingNotes, MAX_NEW_TASKS }, { buildDraft }]) => {
    const PLAN = "11111111-1111-4111-8111-111111111111";
    const TODAY = "2026-10-11";

    test("only new tasks: repeats of existing titles and bad fields are dropped", () => {
      const out = readExtendOutput(
        {
          tasks: [
            { title: "Checkpoint 1", date: null, time: null, notes: "", startAction: "" },
            { title: "Mock interview", date: "2026-10-14", time: "9:30", notes: "with Ms. K", startAction: "Open the doc" },
            { title: "  checkpoint 1 ", date: null, time: null, notes: "", startAction: "" },
            { title: "Read rubric", date: "next tuesday", time: "25:00", notes: "", startAction: "" },
            { title: "", date: null, time: null, notes: "", startAction: "" },
          ],
          new_title: "  ",
        },
        ["Read rubric"]
      );
      assert.deepEqual(out.tasks.map((t) => t.title), ["Checkpoint 1", "Mock interview"]);
      assert.equal(out.tasks[1].time, "09:30");
      assert.equal(out.new_title, null);
      const many = readExtendOutput({ tasks: Array.from({ length: 30 }, (_, i) => ({ title: `T${i}`, date: null, time: null, notes: "", startAction: "" })), new_title: null }, []);
      assert.equal(many.tasks.length, MAX_NEW_TASKS);
      assert.deepEqual(readExtendOutput("garbage", []).tasks, []);
    });

    test("target dates: the day said, else every other day after the plan's last task", () => {
      const tasks = readExtendOutput(
        { tasks: [{ title: "A", date: null, time: null, notes: "", startAction: "" }, { title: "B", date: "2026-10-20", time: null, notes: "", startAction: "" }, { title: "C", date: null, time: null, notes: "", startAction: "" }], new_title: null },
        []
      ).tasks;
      assert.deepEqual(targetDates(tasks, TODAY, "2026-10-15"), ["2026-10-16", "2026-10-20", "2026-10-18"]);
      assert.deepEqual(targetDates(tasks, TODAY, null), ["2026-10-12", "2026-10-20", "2026-10-14"]);
    });

    test("a day and time the student said are kept; spacing's choices are marked and noted", () => {
      const tasks = readExtendOutput(
        {
          tasks: [
            { title: "Checkpoint 1", date: null, time: null, notes: "", startAction: "" },
            { title: "Mock interview", date: "2026-10-14", time: "09:30", notes: "", startAction: "" },
            { title: "Checkpoint 2", date: "2026-10-16", time: null, notes: "", startAction: "" },
          ],
          new_title: null,
        },
        []
      ).tasks;
      const placed = applyPlacements(tasks, [
        { date: "2026-10-13", time: "16:30" },
        { date: "2026-10-15", time: "17:00" },
        { date: "2026-10-17", time: "15:00" },
      ]);
      assert.deepEqual(placed.map((p) => [p.date, p.time, p.spacedDay, p.spacedTime]), [
        ["2026-10-13", "16:30", true, true],
        ["2026-10-14", "09:30", false, false],
        ["2026-10-16", "15:00", false, true],
      ]);
      const notes = spacingNotes(placed);
      assert.equal(notes.length, 2);
      assert.match(notes[0], /Spacing picked Tue, Oct 13 at 4:30 PM for Checkpoint 1/);
      assert.match(notes[1], /3:00 PM for Checkpoint 2 \(the day you said\)/);
    });

    test("ops: add_task with plan_id, update_plan only on a rename, never create_plan", () => {
      const placed = applyPlacements(readExtendOutput({ tasks: [{ title: "Checkpoint 1", date: null, time: null, notes: "", startAction: "" }, { title: "Checkpoint 2", date: null, time: null, notes: "", startAction: "" }], new_title: null }, []).tasks, [
        { date: "2026-10-13", time: "16:30" },
        { date: "2026-10-15", time: "16:30" },
      ]);
      const ops = extendOps(PLAN, placed, null);
      assert.equal(ops.length, 2);
      assert.ok(ops.every((o) => o.op === "add_task" && o.plan_id === PLAN && !o.plan_ref));
      const renamed = extendOps(PLAN, placed, "ICF Finals");
      assert.deepEqual(renamed[0], { op: "update_plan", plan_id: PLAN, title: "ICF Finals" });
      assert.ok(!renamed.some((o) => o.op === "create_plan"));
    });

    test("the header: Updating ICF Prep · 6 tasks → 8 tasks, kept as the draft summary", () => {
      assert.equal(extendHeader("ICF Prep", 6, 2), "Updating ICF Prep · 6 tasks → 8 tasks");
      assert.equal(extendHeader("Solo", 0, 1), "Updating Solo · 0 tasks → 1 task");
      const placed = applyPlacements(readExtendOutput({ tasks: [{ title: "Checkpoint 1", date: null, time: null, notes: "", startAction: "" }], new_title: null }, []).tasks, [{ date: "2026-10-13", time: "16:30" }]);
      const built = buildDraft({
        id: "22222222-2222-4222-8222-222222222222",
        userId: "33333333-3333-4333-8333-333333333333",
        source: "typed",
        requestText: "add a checkpoint to my ICF prep",
        summary: "Add to plan",
        headline: extendHeader("ICF Prep", 6, 1),
        intent: "add_to_plan",
        targetPlanId: PLAN,
        ops: extendOps(PLAN, placed, null),
        now: "2026-10-11T12:00:00Z",
      });
      assert.ok(built.ok);
      if (built.ok) {
        assert.equal(built.changeSet.summary, "Updating ICF Prep · 6 tasks → 7 tasks");
        assert.equal(built.changeSet.target_plan_id, PLAN);
      }
    });
  }
);
