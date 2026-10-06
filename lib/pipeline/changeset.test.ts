// Run with `npm test` (Node's built-in runner; Node strips the types).
// The app imports without file extensions, which plain Node cannot resolve, so
// a resolve hook adds ".ts" before the modules under test are loaded.
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

type Mod = typeof import("./changeset");

void (import("./changeset") as Promise<Mod>).then(({ parseChangeSet, describeChangeSet }) => {
  const USER = "00000000-0000-4000-8000-000000000001";
  const PLAN = "11111111-1111-4111-8111-000000000001";
  const TASK = "22222222-2222-4222-8222-000000000001";
  const MON = "2026-10-05"; // a Monday

  function draft(over: Record<string, unknown> = {}) {
    return {
      id: "33333333-3333-4333-8333-000000000001",
      user_id: USER,
      source: "typed",
      request_text: "add 2 checkpoints to my ICF prep before friday",
      summary: "Add 2 checkpoints to ICF Prep",
      intent: "add_to_plan",
      target_plan_id: PLAN,
      ops: [
        { op: "add_task", title: "Draft ICF essay", date: "2026-10-07", time: "16:00", plan_id: PLAN },
        { op: "add_task", title: "Review ICF essay", date: "2026-10-08", time: "16:00", plan_id: PLAN },
      ],
      assumptions: ["Assumed 4 PM since no time was given"],
      status: "draft",
      created_at: "2026-10-05T14:00:00.000Z",
      confirmed_at: null,
      action_id: null,
      ...over,
    };
  }

  // ─── Schema ─────────────────────────────────────────────────────────────────

  test("a well-formed draft parses", () => {
    const r = parseChangeSet(draft());
    assert.equal(r.ok, true);
  });

  test("every op kind parses", () => {
    const r = parseChangeSet(
      draft({
        intent: "new_plan",
        target_plan_id: null,
        ops: [
          { op: "create_plan", ref: "p1", title: "SAT Prep", notes: "3 weeks" },
          { op: "add_task", title: "Practice test", date: "2026-10-10", plan_ref: "p1" },
          { op: "update_plan", plan_id: PLAN, title: "ICF Final Push" },
          { op: "update_task", task_id: TASK, notes: "bring calculator" },
          { op: "move_task", task_id: TASK, date: "2026-10-09", time: "" },
          { op: "complete_task", task_id: TASK },
          { op: "delete_task", task_id: TASK },
        ],
      })
    );
    assert.equal(r.ok, true, r.ok ? "" : r.error);
  });

  test("unknown keys and unknown ops are rejected", () => {
    assert.equal(parseChangeSet(draft({ extra: 1 })).ok, false);
    assert.equal(parseChangeSet(draft({ ops: [{ op: "add_task", title: "x", date: MON, priority: "high" }] })).ok, false);
    assert.equal(parseChangeSet(draft({ ops: [{ op: "explode", task_id: TASK }] })).ok, false);
  });

  test("field formats are enforced", () => {
    const bad = [
      { id: "not-a-uuid" },
      { source: "email" },
      { status: "applied" },
      { intent: "chat" },
      { summary: "" },
      { created_at: "yesterday" },
      { assumptions: Array.from({ length: 11 }, () => "x") },
      { ops: [{ op: "add_task", title: "x", date: "10/07/2026" }] },
      { ops: [{ op: "add_task", title: "x", date: MON, time: "4pm" }] },
      { ops: [{ op: "add_task", title: "   ", date: MON }] },
      { ops: [{ op: "complete_task", task_id: "t1" }] },
    ];
    for (const over of bad) assert.equal(parseChangeSet(draft(over)).ok, false, JSON.stringify(over));
  });

  test("update ops must change something", () => {
    assert.equal(parseChangeSet(draft({ ops: [{ op: "update_task", task_id: TASK }] })).ok, false);
    assert.equal(parseChangeSet(draft({ ops: [{ op: "update_plan", plan_id: PLAN }] })).ok, false);
  });

  test("plan_ref needs an earlier create_plan, refs are unique, and plan_id/plan_ref are exclusive", () => {
    const late = parseChangeSet(
      draft({
        ops: [
          { op: "add_task", title: "x", date: MON, plan_ref: "p1" },
          { op: "create_plan", ref: "p1", title: "Plan" },
        ],
      })
    );
    assert.equal(late.ok, false);
    const dup = parseChangeSet(
      draft({
        ops: [
          { op: "create_plan", ref: "p1", title: "A" },
          { op: "create_plan", ref: "p1", title: "B" },
        ],
      })
    );
    assert.equal(dup.ok, false);
    const both = parseChangeSet(
      draft({
        ops: [
          { op: "create_plan", ref: "p1", title: "A" },
          { op: "add_task", title: "x", date: MON, plan_ref: "p1", plan_id: PLAN },
        ],
      })
    );
    assert.equal(both.ok, false);
  });

  test("question and clarify ChangeSets carry no ops", () => {
    assert.equal(parseChangeSet(draft({ intent: "question", target_plan_id: null, ops: [] })).ok, true);
    assert.equal(parseChangeSet(draft({ intent: "clarify" })).ok, false);
  });

  test("a parse error names the failing path", () => {
    const r = parseChangeSet(draft({ ops: [{ op: "complete_task", task_id: "t1" }] }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /ops\.0\.task_id/);
  });

  // ─── describeChangeSet ──────────────────────────────────────────────────────

  test("adds read like the preview", () => {
    const lines = describeChangeSet(
      { ops: [{ op: "add_task", title: "Draft ICF essay", date: "2026-10-07", time: "16:00" }] },
      { today: MON }
    );
    assert.deepEqual(lines, ["Add 'Draft ICF essay' · Wed 4:00 PM"]);
  });

  test("dates a week or more away, or with no today, include the date", () => {
    const op = { op: "add_task" as const, title: "SAT", date: "2026-10-24", time: "09:00" };
    assert.deepEqual(describeChangeSet({ ops: [op] }, { today: MON }), ["Add 'SAT' · Sat Oct 24 9:00 AM"]);
    assert.deepEqual(describeChangeSet({ ops: [{ ...op, date: "2026-10-07", time: "" }] }), ["Add 'SAT' · Wed Oct 7"]);
  });

  test("adds to an existing plan name it; tasks of a new plan don't repeat it", () => {
    const lines = describeChangeSet(
      {
        ops: [
          { op: "add_task", title: "Mock interview", date: "2026-10-10", time: "10:00", plan_id: PLAN },
          { op: "create_plan", ref: "p1", title: "SAT Prep" },
          { op: "add_task", title: "Practice test", date: "2026-10-11", plan_ref: "p1" },
        ],
      },
      { today: MON, plans: [{ id: PLAN, title: "ICF Prep" }] }
    );
    assert.deepEqual(lines, ["Add 'Mock interview' to 'ICF Prep' · Sat 10:00 AM", "New plan 'SAT Prep'", "Add 'Practice test' · Sun"]);
  });

  test("task ops name the task when known and fall back otherwise", () => {
    const ops = [
      { op: "move_task" as const, task_id: TASK, date: "2026-10-09", time: "17:00" },
      { op: "complete_task" as const, task_id: TASK },
      { op: "delete_task" as const, task_id: TASK },
      { op: "update_task" as const, task_id: TASK, title: "Bio review", time: "18:30" },
    ];
    assert.deepEqual(describeChangeSet({ ops }, { today: MON, tasks: [{ id: TASK, title: "Bio quiz" }] }), [
      "Move 'Bio quiz' → Fri 5:00 PM",
      "Complete 'Bio quiz'",
      "Delete 'Bio quiz'",
      "Change 'Bio quiz': rename to 'Bio review', time 6:30 PM",
    ]);
    assert.deepEqual(describeChangeSet({ ops: [ops[1]] }), ["Complete a task"]);
  });

  test("plan updates", () => {
    const known = { plans: [{ id: PLAN, title: "ICF Prep" }] };
    assert.deepEqual(describeChangeSet({ ops: [{ op: "update_plan", plan_id: PLAN, title: "ICF Final Push" }] }, known), [
      "Rename plan 'ICF Prep' to 'ICF Final Push'",
    ]);
    assert.deepEqual(describeChangeSet({ ops: [{ op: "update_plan", plan_id: PLAN, notes: "due Nov 1" }] }, known), [
      "Update notes on plan 'ICF Prep'",
    ]);
  });

  test("no ops, no lines; describe never mutates its input", () => {
    assert.deepEqual(describeChangeSet({ ops: [] }), []);
    const cs = draft();
    const before = JSON.stringify(cs);
    describeChangeSet(cs as never, { today: MON });
    assert.equal(JSON.stringify(cs), before);
  });
});
