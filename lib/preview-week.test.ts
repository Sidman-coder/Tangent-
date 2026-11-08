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
import type { ChangeSet } from "./pipeline/changeset";
import type { Task } from "./types";

void (import("./preview-week") as Promise<typeof import("./preview-week")>).then(({ DAY_START, mondayOf, opDates, placeInDay, previewWeeks, whyLine }) => {
  type Op = ChangeSet["ops"][number];
  const add = (title: string, date: string, time?: string, extra: object = {}) => ({ op: "add_task", title, date, time, ...extra }) as Op;
  const task = (over: Partial<Task>) => ({ id: "t", title: "Soccer", date: "2026-11-04", time: "16:00", completed: false, ...over }) as Task;

  test("weeks start on Monday, Sunday included", () => {
    assert.equal(mondayOf("2026-11-02"), "2026-11-02");
    assert.equal(mondayOf("2026-11-08"), "2026-11-02");
    assert.equal(mondayOf("2026-11-09"), "2026-11-09");
  });

  test("hours outside 7:00 to 23:00 press against the edge", () => {
    assert.deepEqual(placeInDay(DAY_START, DAY_START + 480), { topPct: 0, heightPct: 50 });
    assert.equal(placeInDay(60, 90).topPct, 0);
    const late = placeInDay(23 * 60 + 30, 24 * 60);
    assert.equal(late.topPct + late.heightPct, 100);
  });

  test("it opens on the first new task's week and leaves no gaps", () => {
    const weeks = previewWeeks([add("Later", "2026-11-18", "10:00"), add("First", "2026-11-04", "10:00")], []);
    assert.equal(weeks.length, 3);
    assert.equal(weeks[0].start, "2026-11-02");
    assert.equal(weeks[0].blocks[0].title, "First");
    assert.equal(weeks[0].blocks[0].dayIndex, 2);
    assert.equal(weeks[1].blocks.length, 0);
    assert.equal(weeks[2].blocks[0].title, "Later");
  });

  test("a change with no new tasks has no calendar to show", () => {
    assert.deepEqual(previewWeeks([{ op: "delete_task", task_id: "x" } as Op], [task({})]), []);
  });

  test("the calendar shows behind the new work, done and due-only work doesn't", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", completed: true }), task({ id: "c", time: "23:59", source: "canvas" })];
    const blocks = previewWeeks([add("New", "2026-11-04", "10:00")], tasks)[0].blocks;
    assert.deepEqual(blocks.map((b) => [b.kind, b.title]), [["existing", "Soccer"], ["new", "New"]]);
    assert.equal(blocks[0].color, null);
    assert.ok(blocks[1].color);
  });

  test("School Blocks are marked and run to their end", () => {
    const school = task({ id: "s", title: "School", kind: "school", time: "08:00", notes: "Until 3:00 PM", recurring: { enabled: true, parentId: "p" } } as Partial<Task>);
    const [block] = previewWeeks([add("New", "2026-11-04", "16:00")], [school])[0].blocks;
    assert.equal(block.kind, "school");
    assert.ok(block.heightPct > 40);
  });

  test("a moved task shows once, at its new spot", () => {
    const moved = { op: "move_task", task_id: "a", date: "2026-11-05", time: "09:00" } as Op;
    const blocks = previewWeeks([moved], [task({ id: "a" })])[0].blocks;
    assert.deepEqual(blocks.map((b) => [b.kind, b.title, b.dayIndex]), [["new", "Soccer", 3]]);
  });

  test("a task with no time goes in the strip", () => {
    assert.equal(previewWeeks([add("Whenever", "2026-11-04")], [])[0].blocks[0].topPct, null);
  });

  test("repeats expand, an open series stops at four weeks", () => {
    const op = add("Run", "2026-11-03", "07:00", { repeat: { frequency: "weekly", daysOfWeek: [2, 4] } });
    const dates = opDates(op as Extract<Op, { op: "add_task" }>);
    assert.equal(dates[0], "2026-11-03");
    assert.equal(dates[1], "2026-11-05");
    assert.equal(dates.length, 8);
    const ending = add("Run", "2026-11-03", "07:00", { repeat: { frequency: "daily", endDate: "2026-11-05" } });
    assert.equal(opDates(ending as Extract<Op, { op: "add_task" }>).length, 3);
  });

  test("the why is one short line", () => {
    assert.equal(whyLine("GOAL: Learn the chords. TIME: 30 mins."), "Learn the chords.");
    assert.equal(whyLine("", "Open the book"), "Open the book");
    assert.equal(whyLine(null), null);
    assert.ok((whyLine("x".repeat(200)) ?? "").length <= 90);
  });
});
