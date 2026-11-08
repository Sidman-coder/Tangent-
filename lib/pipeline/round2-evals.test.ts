// Run with `npm test`. Round 2 F.2: the eval set is valid and big enough, and
// the graders read answers the way the eval run will. No AI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Same resolve hook as grade.test.ts: extensionless and "@/" imports.
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(path.resolve(import.meta.dirname, "..", ".."), s.slice(2))).href;
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

type Mod = typeof import("./grade");

void (import("./grade") as Promise<Mod>).then(({ Round2FileSchema, gradeKind, gradeSlots, gradeRoute, gradeTitle, routeKindOf }) => {
  const raw = JSON.parse(readFileSync(new URL("./fixtures/round2.json", import.meta.url), "utf8")) as unknown;

  test("round2 fixtures are valid, unique and cover every kind and route", () => {
    const file = Round2FileSchema.parse(raw);
    assert.ok(file.kinds.length >= 20, "20+ task-kind cases");
    assert.ok(file.slots.length >= 15, "15+ slot cases");
    assert.ok(file.routes.length >= 15, "15+ routing cases");
    assert.ok(file.titles.length >= 10, "10+ title cases");
    const ids = [...file.kinds, ...file.slots, ...file.routes, ...file.titles].map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, "ids are unique");
    for (const k of ["fixed", "reminder", "flexible"]) assert.ok(file.kinds.some((c) => c.kind === k), k);
    for (const r of ["question", "task", "plan"]) assert.ok(file.routes.filter((c) => c.expect === r).length >= 4, r);
  });

  test("graders", () => {
    assert.equal(gradeKind("fixed", "fixed").pass, true);
    assert.deepEqual(gradeKind("fixed", "reminder").failures, ["kind: expected fixed, got reminder"]);
    assert.equal(gradeSlots({ has: ["deadline"] }, ["deadline", "outcome"]).pass, true);
    assert.deepEqual(gradeSlots({ has: ["deadline"], lacks: ["outcome"] }, ["outcome"]).failures, ["slots: missing deadline", "slots: guessed outcome"]);
    assert.equal(routeKindOf({ route: "chat", intent: null }), "question");
    assert.equal(routeKindOf({ route: "fast", intent: null }), "task");
    assert.equal(routeKindOf({ route: "draft", intent: "new_plan" }), "plan");
    assert.equal(routeKindOf({ route: "clarify", intent: "clarify" }), null);
    assert.equal(gradeRoute("task", { route: "draft", intent: "add_task" }).pass, true);
    assert.equal(gradeRoute("plan", { route: "clarify", intent: "clarify" }).pass, false);
    assert.equal(gradeTitle({ project: "Robotics" }, "Finish the budget spreadsheet").pass, true);
    assert.deepEqual(gradeTitle({}, null).failures, ["title: none"]);
    assert.equal(gradeTitle({ project: "Robotics" }, "Robotics budget spreadsheet").pass, false);
    assert.equal(gradeTitle({}, "Remind me to email the teacher").pass, false);
    assert.equal(gradeTitle({}, "Read chapters 4 and 5.").pass, false);
    assert.equal(gradeTitle({}, "Study").pass, false);
    assert.equal(gradeTitle({}, "Read the whole first half of the novel tonight").pass, false);
  });
});
