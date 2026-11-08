// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
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

type Notes = typeof import("./project-notes");
void (import("./project-notes") as Promise<Notes>).then(({ splitProjectNotes, joinProjectNotes }) => {
  const stored = "Get a 1450 on the SAT\nBrief — Deadline: Dec 6 · Hours per week: 5\nAssumed — Every section, weakest first · At your open times after school";

  test("splits the goal, what the student said and the defaults", () => {
    const notes = splitProjectNotes(stored);
    assert.equal(notes.goal, "Get a 1450 on the SAT");
    assert.deepEqual(notes.known, [
      { label: "Deadline", value: "Dec 6" },
      { label: "Hours per week", value: "5" },
    ]);
    assert.deepEqual(notes.assumed, ["Every section, weakest first", "At your open times after school"]);
    assert.equal(notes.briefLines.length, 2);
  });

  test("a plain goal has no brief", () => {
    assert.deepEqual(splitProjectNotes("Learn to juggle"), { goal: "Learn to juggle", known: [], assumed: [], briefLines: [] });
    assert.deepEqual(splitProjectNotes(""), { goal: "", known: [], assumed: [], briefLines: [] });
    assert.deepEqual(splitProjectNotes(null).goal, "");
  });

  test("a brief with no goal, and a value with a colon in it", () => {
    const notes = splitProjectNotes("Assumed — Safe start: technique first");
    assert.equal(notes.goal, "");
    assert.deepEqual(notes.assumed, ["Safe start: technique first"]);
    assert.deepEqual(splitProjectNotes("Brief — Times: 4:30 PM").known, [{ label: "Times", value: "4:30 PM" }]);
  });

  test("saving a new goal keeps the brief lines", () => {
    const { briefLines } = splitProjectNotes(stored);
    assert.equal(joinProjectNotes("Get a 1500 on the SAT ", briefLines), stored.replace("1450", "1500"));
    assert.equal(joinProjectNotes("", briefLines), briefLines.join("\n"));
    assert.equal(joinProjectNotes("Just a goal", []), "Just a goal");
  });
});
