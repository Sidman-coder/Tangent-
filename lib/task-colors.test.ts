// Run with `npm test`. Same resolve hook as ics.test.ts.
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


type Mod = typeof import("./task-colors");
void (import("./task-colors") as Promise<Mod>).then(({ taskCategory, taskColor, CATEGORY_LABEL, categoryLabel, groupByCategory }) => {
  test("Canvas wins over every kind", () => {
    assert.equal(taskCategory({ source: "canvas", kind: "school", title: "Lab 4" }), "canvas");
    assert.equal(taskCategory({ source: "canvas", kind: "side-ec", title: "x" }), "canvas");
  });

  test("school work the student adds is Academic", () => {
    assert.equal(taskCategory({ kind: "school", title: "Period 3" }), "academic");
    assert.equal(taskCategory({ kind: "personal", title: "Study for chem test" }), "academic");
    assert.equal(taskCategory({ title: "Finish APUSH essay" }), "academic");
    assert.equal(taskCategory({ title: "calc homework 4.3" }), "academic");
  });

  test("both extracurricular kinds are ECs", () => {
    assert.equal(taskCategory({ kind: "academic-ec", title: "Robotics CAD: intake arm" }), "ec");
    assert.equal(taskCategory({ kind: "side-ec", title: "Soccer practice" }), "ec");
  });

  test("commitments, personal and kindless errands are Other", () => {
    assert.equal(taskCategory({ kind: "commitment", title: "Piano lesson" }), "other");
    assert.equal(taskCategory({ kind: "personal", title: "Buy poster board" }), "other");
    assert.equal(taskCategory({ title: "Pick up prescription" }), "other");
  });

  test("an EC kind is not re-read as Academic from its title", () => {
    assert.equal(taskCategory({ kind: "academic-ec", title: "Study the competition rubric" }), "ec");
  });

  test("taskColor maps the category to its token and labels read as agreed", () => {
    assert.equal(taskColor({ source: "canvas", title: "x" }), "var(--cat-canvas)");
    assert.equal(taskColor({ title: "Buy poster board" }), "var(--cat-other)");
    assert.deepEqual(CATEGORY_LABEL, { canvas: "Canvas", academic: "Academic", ec: "ECs", other: "Other" });
  });
  test("a task Tangent filed on the School calendar is Academic", () => {
    assert.equal(taskCategory({ calendarId: "cal_school", title: "Finish the slides" }), "academic");
  });

  test("once the AI has called it personal, a schoolwork-sounding title stays Other", () => {
    assert.equal(taskCategory({ kind: "personal", calendarId: "cal_other", title: "Read a chapter of Dune" }), "other");
  });
  test("rows are labelled by the same category as their dot, and grey ones carry no label", () => {
    assert.equal(categoryLabel({ source: "canvas", kind: "school", title: "Lab" }), "Canvas");
    assert.equal(categoryLabel({ kind: "personal", title: "Study for APUSH quiz" }), "Academic");
    assert.equal(categoryLabel({ kind: "academic-ec", title: "CAD" }), "ECs");
    assert.equal(categoryLabel({ kind: "personal", title: "Buy milk" }), null);
  });

  test("a day groups into Canvas, Academic, ECs, Other, in that order, skipping empty groups", () => {
    const groups = groupByCategory([
      { id: "a", kind: "personal", title: "Buy milk" },
      { id: "b", kind: "side-ec", title: "Soccer" },
      { id: "c", source: "canvas", title: "Lab" },
      { id: "d", kind: "academic-ec", title: "CAD" },
    ]);
    assert.deepEqual(groups.map((g) => [g.category, g.tasks.map((t) => t.id)]), [["canvas", ["c"]], ["ec", ["b", "d"]], ["other", ["a"]]]);
  });
});
