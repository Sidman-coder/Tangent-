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


type Mod = typeof import("./capture-list");
void (import("./capture-list") as Promise<Mod>).then(({ buildCaptureList, captureSections, parseCaptureLens }) => {
  const T = (o: Record<string, unknown>) => ({ id: String(o.title), date: "2026-10-26", time: "23:59", completed: false, ...o }) as never;
  const today = "2026-10-26";
  const plans = [{ id: "p1", title: "Robotics", description: "", taskIds: [], color: "#000", createdAt: "", taskCount: 1 }];

  test("an empty account gives an empty list", () => {
    assert.deepEqual(buildCaptureList([], [], today), []);
  });

  test("drops done work, School Blocks, handled Canvas and anything past two weeks", () => {
    const rows = buildCaptureList(
      [
        T({ title: "done", completed: true }),
        T({ title: "Period 3", kind: "school" }),
        T({ title: "old canvas", source: "canvas", kind: "school", date: "2026-10-23" }),
        T({ title: "far", date: "2026-11-10" }),
        T({ title: "kept", date: "2026-11-09" }),
        T({ title: "practice", kind: "commitment" }),
      ],
      [],
      today
    );
    assert.deepEqual(rows.map((r) => r.task.title), ["kept"]);
  });

  test("overdue first, then today by time, then later days", () => {
    const rows = buildCaptureList(
      [
        T({ title: "tomorrow", date: "2026-10-27", time: "08:00" }),
        T({ title: "today late", time: "17:00" }),
        T({ title: "today early", time: "09:00" }),
        T({ title: "overdue", date: "2026-10-25", time: "12:00" }),
      ],
      [],
      today
    );
    assert.deepEqual(rows.map((r) => r.task.title), ["overdue", "today early", "today late", "tomorrow"]);
    assert.equal(rows[0].overdue, true);
    assert.equal(rows[1].overdue, false);
  });

  test("the subline says when, and where it came from", () => {
    const rows = buildCaptureList(
      [
        T({ title: "a", date: "2026-10-25" }),
        T({ title: "b" }),
        T({ title: "c", date: "2026-10-27", source: "canvas", kind: "school" }),
        T({ title: "d", date: "2026-10-29", planId: "p1" }),
        T({ title: "e", date: "2026-11-05" }),
      ],
      plans as never,
      today
    );
    assert.deepEqual(rows.map((r) => r.sub), ["Overdue", "Today", "Tomorrow · Canvas", "Thu · Robotics", "Nov 5"]);
  });
  test("groups: urgent, then assignments, then projects, then personal", () => {
    const rows = buildCaptureList(
      [
        T({ title: "late step", date: "2026-10-25", planId: "p1", commitment: "flexible" }),
        T({ title: "essay", date: "2026-10-30", source: "canvas", kind: "school", commitment: "fixed" }),
        T({ title: "dentist", date: "2026-10-27", time: "15:00", commitment: "fixed" }),
        T({ title: "step today", planId: "p1", commitment: "flexible" }),
        T({ title: "laundry", date: "2026-10-29", commitment: "flexible" }),
      ],
      plans as never,
      today
    );
    const sections = captureSections(rows, plans as never, today);
    assert.deepEqual(
      sections.map((s) => [s.label, s.rows.map((r) => r.task.title)]),
      [
        ["Urgent", ["late step", "dentist"]],
        ["Assignments", ["essay"]],
        ["Projects", ["step today"]],
        ["Personal", ["laundry"]],
      ]
    );
  });

  test("the Urgent chip shows only urgent; Projects shows every step, by project", () => {
    const rows = buildCaptureList(
      [
        T({ title: "late step", date: "2026-10-25", planId: "p1", commitment: "flexible" }),
        T({ title: "step", date: "2026-10-28", planId: "p1", commitment: "flexible" }),
        T({ title: "call mom", commitment: "reminder" }),
      ],
      plans as never,
      today
    );
    assert.deepEqual(captureSections(rows, plans as never, today, "urgent").map((s) => s.rows.length), [2]);
    const byProject = captureSections(rows, plans as never, today, "projects");
    assert.deepEqual(byProject.map((s) => [s.label, s.rows.length]), [["Robotics", 2]]);
    assert.equal(parseCaptureLens("nope"), "all");
    assert.equal(parseCaptureLens("urgent"), "urgent");
  });
});
