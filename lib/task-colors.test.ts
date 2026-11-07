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
void (import("./task-colors") as Promise<Mod>).then(({
  taskCategory,
  taskColor,
  CATEGORY_LABEL,
  categoryLabel,
  groupByCategory,
  SERIES_PALETTE,
  SERIES_KEYS,
  SERIES_CSS,
  assignProjectColor,
  courseColor,
  projectSeries,
  canvasCourseOf,
  taskSeries,
  readableInk,
  contrastRatio,
  seriesColor,
}) => {
  test("the palette has ten hues", () => {
    assert.equal(SERIES_KEYS.length, 10);
  });

  test("every hue is visible on its theme's surfaces", () => {
    for (const key of SERIES_KEYS) {
      for (const surface of ["#ffffff", "#f7f6fb", "#f1eff7"]) {
        assert.ok(contrastRatio(SERIES_PALETTE[key].light, surface) >= 3, `${key} light on ${surface}`);
      }
      for (const surface of ["#1b1a24", "#121119", "#24222f"]) {
        assert.ok(contrastRatio(SERIES_PALETTE[key].dark, surface) >= 3, `${key} dark on ${surface}`);
      }
    }
  });

  test("text on every colored block passes AA", () => {
    for (const key of SERIES_KEYS) {
      for (const hex of [SERIES_PALETTE[key].light, SERIES_PALETTE[key].dark]) {
        assert.ok(contrastRatio(hex, readableInk(hex)) >= 4.5, `${key} ${hex}`);
      }
    }
  });

  test("readableInk picks by luminance", () => {
    assert.equal(readableInk("#000000"), "#ffffff");
    assert.equal(readableInk("#ffffff"), "#17132a");
    assert.equal(readableInk("#4b3a8c"), "#ffffff");
    assert.equal(readableInk("#e0b04c"), "#17132a");
  });

  test("the CSS sets a color and an ink for every hue in both themes", () => {
    for (const key of [...SERIES_KEYS, "personal", "neutral"]) {
      assert.equal(SERIES_CSS.split(`--series-${key}:`).length, 3, key);
      assert.equal(SERIES_CSS.split(`--series-${key}-ink:`).length, 3, key);
    }
    assert.equal(seriesColor("teal"), "var(--series-teal)");
  });

  test("assignProjectColor walks the palette from empty", () => {
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) seen.push(assignProjectColor(seen));
    assert.deepEqual(seen, SERIES_KEYS);
  });

  test("assignProjectColor matches the migration's round robin past ten", () => {
    const seen: string[] = [];
    for (let i = 0; i < 23; i++) seen.push(assignProjectColor(seen));
    assert.deepEqual(seen, Array.from({ length: 23 }, (_, i) => SERIES_KEYS[i % 10]));
  });

  test("assignProjectColor picks the least used", () => {
    const list = ["violet", "violet", "teal", "teal", "rose", "blue", "amber", "green", "magenta", "indigo", "orange", "violet"];
    assert.equal(assignProjectColor(list), "cyan");
  });

  test("assignProjectColor avoids the most recent, even when it's least used", () => {
    const allTwiceButCyan = SERIES_KEYS.filter((k) => k !== "cyan").flatMap((k) => [k, k]);
    assert.equal(assignProjectColor([...allTwiceButCyan, "cyan"]), "violet");
  });

  test("assignProjectColor ignores old hex values", () => {
    assert.equal(assignProjectColor(["#4b3a8c", "#1f8f86"]), "violet");
  });

  test("a course always gets the same color, whatever its case", () => {
    assert.equal(courseColor("AP Chem"), courseColor("ap chem "));
    assert.ok(SERIES_KEYS.includes(courseColor("AP Chem")));
  });

  test("the course comes from the end of a Canvas title", () => {
    assert.equal(canvasCourseOf("Lab 4 [AP Chem]"), "AP Chem");
    assert.equal(canvasCourseOf("Lab [4] notes"), "Canvas");
  });

  test("projectSeries keeps a key and hashes an old hex by id", () => {
    assert.equal(projectSeries("rose", "p1"), "rose");
    assert.equal(projectSeries("#2f9e6e", "p1"), projectSeries(null, "p1"));
    assert.ok(SERIES_KEYS.includes(projectSeries("toString", "p1")));
  });

  test("taskSeries: project, then course, then personal or neutral", () => {
    const base = { id: "t", title: "Call grandma", date: "2026-11-04", time: "", completed: false };
    const plans = [{ id: "p1", color: "rose" }];
    assert.equal(taskSeries({ ...base, planId: "p1" }, plans), "rose");
    assert.equal(taskSeries({ ...base, source: "canvas", title: "Lab 4 [AP Chem]" }, plans), courseColor("AP Chem"));
    assert.equal(taskSeries({ ...base, commitment: "reminder" }, plans), "personal");
    assert.equal(taskSeries({ ...base, commitment: "fixed" }, plans), "personal");
    assert.equal(taskSeries({ ...base, commitment: "flexible" }, plans), "neutral");
  });

  test("a deleted project's step still gets a stable hue", () => {
    const base = { id: "t", title: "Step", date: "2026-11-04", time: "", completed: false, planId: "gone" };
    assert.equal(taskSeries(base, []), projectSeries(null, "gone"));
  });

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
