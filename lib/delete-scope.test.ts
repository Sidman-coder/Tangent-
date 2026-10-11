// Run with `npm test`. The safety rules for deletes (lib/delete-scope.ts):
// scoped requests only touch what they name, a full clear needs an explicit
// phrase, and every outcome is a proposal or a question, never a delete.
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

type Mod = typeof import("./delete-scope");

const SAT_PLAN = { id: "p-sat", title: "SAT Prep" };
const ICF_PLAN = { id: "p-icf", title: "ICF essay" };
const TASKS = [
  { id: "t1", title: "SAT practice test 1", planId: "p-sat" },
  { id: "t2", title: "SAT reading drills", planId: "p-sat" },
  { id: "t3", title: "Review SAT math mistakes", planId: "p-sat" },
  { id: "t4", title: "Chem lab report", planId: null },
  { id: "t5", title: "Saturday shift", planId: null },
  { id: "t6", title: "Draft ICF essay intro", planId: "p-icf" },
  { id: "t7", title: "Dentists appointment", planId: null },
];
const PLANS = [SAT_PLAN, ICF_PLAN];

void (import("./delete-scope") as Promise<Mod>).then(({ isFullClearRequest, parseDeleteScope, matchScope, planBulkDelete, bulkDeleteMessage }) => {
  test("the reported request proposes only the SAT tasks", () => {
    const plan = planBulkDelete("Actually, nevermind I dont want the SAT tasks. Take out all of the SAT tasks", TASKS, PLANS);
    assert.equal(plan?.kind, "propose");
    assert.ok(plan && plan.kind === "propose");
    assert.equal(plan.all, false);
    assert.deepEqual(plan.tasks.map((t) => t.id).sort(), ["t1", "t2", "t3"]);
    assert.equal(plan.label, "SAT Prep");
  });

  test("scoped phrasings match the plan first, then titles; SAT never matches Saturday", () => {
    for (const text of ["delete my SAT plan", "remove the SAT stuff", "get rid of all the SAT things", "delete all of the SAT"]) {
      const plan = planBulkDelete(text, TASKS, PLANS);
      assert.ok(plan && plan.kind === "propose", text);
      assert.deepEqual(plan.tasks.map((t) => t.id).sort(), ["t1", "t2", "t3"], text);
    }
    const icf = planBulkDelete("delete the ICF stuff", TASKS, PLANS);
    assert.ok(icf && icf.kind === "propose");
    assert.deepEqual(icf.tasks.map((t) => t.id), ["t6"]);
    // No plan named chem: task titles instead.
    const chem = planBulkDelete("remove all chem tasks", TASKS, PLANS);
    assert.ok(chem && chem.kind === "propose");
    assert.equal(chem.label, "chem");
    assert.deepEqual(chem.tasks.map((t) => t.id), ["t4"]);
  });

  test("delete the SAT stuff with no SAT tasks asks and deletes nothing", () => {
    const others = TASKS.filter((t) => t.planId !== "p-sat");
    const plan = planBulkDelete("delete the SAT stuff", others, [ICF_PLAN]);
    assert.equal(plan?.kind, "ask");
    assert.match(plan && plan.kind === "ask" ? plan.message : "", /couldn't find any tasks or plans matching "sat"/i);
  });

  test("an ambiguous plan match asks", () => {
    const plans = [SAT_PLAN, { id: "p-sat2", title: "SAT Prep (spring)" }];
    const tasks = [...TASKS, { id: "t8", title: "Spring SAT mock", planId: "p-sat2" }];
    const plan = planBulkDelete("delete my SAT plan", tasks, plans);
    assert.equal(plan?.kind, "ask");
    assert.match(plan && plan.kind === "ask" ? plan.message : "", /more than one plan/);
  });

  test("everything-ish requests without an explicit phrase ask instead of clearing", () => {
    for (const text of ["delete all the tasks", "remove all of them", "get rid of the stuff"]) {
      const plan = planBulkDelete(text, TASKS, PLANS);
      assert.equal(plan?.kind, "ask", text);
    }
  });

  test("clear my schedule needs confirmation of every task; it is only ever a proposal", () => {
    for (const text of ["clear my schedule", "Clear my whole schedule.", "delete everything", "delete all my tasks", "please wipe my calendar"]) {
      assert.equal(isFullClearRequest(text), true, text);
      const plan = planBulkDelete(text, TASKS, PLANS);
      assert.ok(plan && plan.kind === "propose", text);
      assert.equal(plan.all, true);
      assert.equal(plan.tasks.length, TASKS.length);
    }
    assert.equal(planBulkDelete("clear my schedule", [], [])?.kind, "empty");
  });

  test("near-misses are not full clears", () => {
    for (const text of [
      "delete all my SAT tasks",
      "Take out all of the SAT tasks",
      "clear my schedule for tomorrow",
      "reset my alarm",
      "I need to clean my room",
      "start fresh",
      "empty the dishwasher",
    ]) {
      assert.equal(isFullClearRequest(text), false, text);
    }
  });

  test("single-task and non-delete requests are left to the existing paths", () => {
    for (const text of ["delete chem lab", "remove the dentist appointment", "add SAT practice tomorrow at 4", "I have a dentists appointment", "clean my room tomorrow"]) {
      assert.equal(parseDeleteScope(text), null, text);
      assert.equal(planBulkDelete(text, TASKS, PLANS), null, text);
    }
  });

  test("matchScope with no match says none", () => {
    assert.equal(matchScope(["ap", "bio"], TASKS, PLANS).kind, "none");
  });

  test("the confirmation shows the count and at most five titles", () => {
    const titles = ["A", "B", "C", "D", "E", "F", "G"];
    assert.equal(bulkDeleteMessage(titles, { label: "SAT Prep" }), 'Delete 7 tasks matching "SAT Prep"? "A", "B", "C", "D", "E" and 2 more.');
    assert.match(bulkDeleteMessage(titles, { all: true }), /^Clear ALL 7 tasks from your schedule\? This removes everything: "A", "B", "C", "D", "E" and 2 more\.$/);
    assert.equal(bulkDeleteMessage(["Only"]), 'Delete 1 task? "Only".');
  });
});
