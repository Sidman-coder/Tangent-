// Run with `npm test` (Node's built-in runner; Node strips the types).
// The app imports without file extensions, which plain Node cannot resolve, so
// a resolve hook adds ".ts" before the modules under test are loaded.
import * as nodeModule from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeOp } from "./changeset";

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

type Mod = typeof import("./grade");

void (import("./grade") as Promise<Mod>).then(({ gradeCase, FixtureFileSchema }) => {
  const ICF = "11111111-1111-4111-8111-000000000001";
  const SAT = "11111111-1111-4111-8111-000000000002";
  const TASK = "22222222-2222-4222-8222-000000000001";
  const seed = { plans: [{ id: ICF, title: "ICF Prep" }, { id: SAT, title: "SAT Prep" }] };

  const add = (title: string, extra: Partial<Extract<ChangeOp, { op: "add_task" }>> = {}): ChangeOp => ({
    op: "add_task",
    title,
    date: "2026-10-07",
    ...extra,
  });

  // ─── gradeCase ──────────────────────────────────────────────────────────────

  const addToIcf = { intent: "add_to_plan" as const, target_plan: "ICF Prep", min_ops: 2, max_ops: 2, must_not: ["create_plan" as const] };

  test("passes a matching ChangeSet", () => {
    const g = gradeCase(addToIcf, { intent: "add_to_plan", target_plan_id: ICF, ops: [add("A", { plan_id: ICF }), add("B", { plan_id: ICF })] }, seed);
    assert.deepEqual(g, { pass: true, failures: [] });
  });

  test("a second ICF plan fails every check", () => {
    const g = gradeCase(
      addToIcf,
      {
        intent: "new_plan",
        target_plan_id: null,
        ops: [{ op: "create_plan", ref: "p1", title: "ICF Prep" }, add("A", { plan_ref: "p1" }), add("B", { plan_ref: "p1" })],
      },
      seed
    );
    assert.equal(g.pass, false);
    assert.ok(g.failures.some((f) => f.startsWith("intent:")));
    assert.ok(g.failures.some((f) => f.startsWith("ops:")));
    assert.ok(g.failures.some((f) => f.startsWith("must_not:")));
    assert.ok(g.failures.some((f) => f.startsWith("target_plan:")));
  });

  test("targeting the wrong existing plan fails and names it", () => {
    const g = gradeCase(addToIcf, { intent: "add_to_plan", target_plan_id: SAT, ops: [add("A"), add("B")] }, seed);
    assert.deepEqual(g.failures, ["target_plan: expected 'ICF Prep', got 'SAT Prep'"]);
  });

  test("op count range", () => {
    const e = { intent: "new_plan" as const, target_plan: "NEW", min_ops: 3, max_ops: 5 };
    const plan = (n: number) => ({
      intent: "new_plan" as const,
      target_plan_id: null,
      ops: [{ op: "create_plan", ref: "p1", title: "SAT" } as ChangeOp, ...Array.from({ length: n - 1 }, (_, i) => add(`t${i}`, { plan_ref: "p1" }))],
    });
    assert.equal(gradeCase(e, plan(2)).pass, false);
    assert.equal(gradeCase(e, plan(3)).pass, true);
    assert.equal(gradeCase(e, plan(5)).pass, true);
    assert.deepEqual(gradeCase(e, plan(6)).failures, ["ops: expected 3–5, got 6"]);
  });

  test("NEW needs a create_plan and no existing target", () => {
    const e = { intent: "new_plan" as const, target_plan: "NEW", min_ops: 1, max_ops: 9 };
    assert.deepEqual(gradeCase(e, { intent: "new_plan", target_plan_id: null, ops: [add("A")] }).failures, [
      "target_plan: expected a new plan, but none is created",
    ]);
    assert.equal(
      gradeCase(e, { intent: "new_plan", target_plan_id: ICF, ops: [{ op: "create_plan", ref: "p", title: "X" }] }).pass,
      false
    );
  });

  test("null target: a single task is not a plan", () => {
    const e = { intent: "add_task" as const, target_plan: null, min_ops: 1, max_ops: 1, must_not: ["create_plan" as const] };
    assert.equal(gradeCase(e, { intent: "add_task", target_plan_id: null, ops: [add("Test")] }).pass, true);
    const week = gradeCase(e, {
      intent: "new_plan",
      target_plan_id: null,
      ops: [{ op: "create_plan", ref: "p1", title: "Test week" }, ...Array.from({ length: 7 }, (_, i) => add(`Day ${i}`, { plan_ref: "p1" }))],
    });
    assert.equal(week.pass, false);
    assert.ok(week.failures.includes("target_plan: expected none, but a plan is created"));
    assert.equal(gradeCase(e, { intent: "add_task", target_plan_id: ICF, ops: [add("Test")] }).pass, false);
  });

  test("question and clarify expect zero ops", () => {
    const e = { intent: "question" as const, target_plan: null, min_ops: 0, max_ops: 0 };
    assert.equal(gradeCase(e, { intent: "question", target_plan_id: null, ops: [] }).pass, true);
    assert.equal(gradeCase(e, { intent: "add_task", target_plan_id: null, ops: [add("Work on ICF")] }).pass, false);
    assert.equal(gradeCase({ ...e, intent: "clarify" }, { intent: "question", target_plan_id: null, ops: [] }).pass, false);
  });

  test("complete_task with must_not", () => {
    const e = { intent: "complete_task" as const, target_plan: null, min_ops: 1, max_ops: 1, must_not: ["add_task" as const, "delete_task" as const] };
    assert.equal(gradeCase(e, { intent: "complete_task", target_plan_id: null, ops: [{ op: "complete_task", task_id: TASK }] }).pass, true);
    assert.equal(gradeCase(e, { intent: "complete_task", target_plan_id: null, ops: [{ op: "delete_task", task_id: TASK }] }).pass, false);
  });

  test("a titled target without a seed only needs some target; a missing ChangeSet fails", () => {
    assert.equal(gradeCase(addToIcf, { intent: "add_to_plan", target_plan_id: SAT, ops: [add("A"), add("B")] }).pass, true);
    assert.equal(gradeCase(addToIcf, { intent: "add_to_plan", target_plan_id: null, ops: [add("A"), add("B")] }).pass, false);
    assert.deepEqual(gradeCase(addToIcf, null), { pass: false, failures: ["no ChangeSet was produced"] });
  });

  test("grading is pure", () => {
    const cs = { intent: "add_to_plan" as const, target_plan_id: ICF, ops: [add("A"), add("B")] };
    const before = JSON.stringify(cs);
    const a = gradeCase(addToIcf, cs, seed);
    const b = gradeCase(addToIcf, cs, seed);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(cs), before);
  });

  // ─── The fixture file ───────────────────────────────────────────────────────

  const raw = JSON.parse(readFileSync(new URL("./fixtures/requests.json", import.meta.url), "utf8"));
  const parsed = FixtureFileSchema.safeParse(raw);

  test("fixtures: valid, 30 cases, unique ids", () => {
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
    if (!parsed.success) return;
    const cases = parsed.data.cases;
    assert.equal(cases.length, 30);
    assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  });

  test("fixtures: every titled target is a seeded plan; seeded task plans exist", () => {
    if (!parsed.success) return assert.fail("fixture file is invalid");
    for (const c of parsed.data.cases) {
      const t = c.expected.target_plan;
      if (t !== null && t !== "NEW") assert.ok(c.seed.plans.some((p) => p.title === t), `${c.id}: '${t}' not seeded`);
      for (const task of c.seed.tasks) {
        if (task.planId) assert.ok(c.seed.plans.some((p) => p.id === task.planId), `${c.id}: ${task.title} has an unseeded plan`);
      }
      if (c.expected.intent === "question" || c.expected.intent === "clarify") assert.equal(c.expected.max_ops, 0, c.id);
    }
  });

  test("fixtures: the required cases are present", () => {
    if (!parsed.success) return assert.fail("fixture file is invalid");
    const byText = (text: string) => {
      const c = parsed.data.cases.find((x) => x.text === text);
      assert.ok(c, `missing case: ${text}`);
      return c;
    };
    const icf = byText("add 2 checkpoints to my iCF prep before friday");
    assert.equal(icf.expected.target_plan, "ICF Prep");
    assert.ok(icf.seed.plans.some((p) => p.title === "ICF Prep"));
    assert.ok(icf.expected.must_not?.includes("create_plan"));

    const voice = byText("add two checkpoints to my eye see eff prep");
    assert.equal(voice.source, "voice");
    assert.ok(voice.expected.must_not?.includes("create_plan"));

    const test1 = byText("I have a test next week");
    assert.equal(test1.expected.intent, "add_task");
    assert.equal(test1.expected.max_ops, 1);

    const done = byText("done with math hw");
    assert.equal(done.expected.intent, "complete_task");
    assert.equal(done.no_ai, true);

    assert.equal(byText("help me study for the SAT in 3 weeks").expected.target_plan, "NEW");

    const q = byText("what should I do for my ICF project?");
    assert.equal(q.expected.intent, "question");
    assert.equal(q.expected.max_ops, 0);

    assert.ok(parsed.data.cases.filter((c) => c.expected.intent === "clarify").length >= 2);
  });
});
