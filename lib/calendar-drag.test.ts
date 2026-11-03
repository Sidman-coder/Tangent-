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
import type { Task } from "./types";

void (import("./calendar-drag") as Promise<typeof import("./calendar-drag")>).then(({ LATEST_START, canDragTask, columnAt, dropTarget, minutesToTime, nudge, overlapAt, pixelsToMinutes, snapMinutes }) => {

const HOUR = 56;

test("pixels snap to the nearest 15 minutes", () => {
  assert.equal(pixelsToMinutes(HOUR, HOUR), 60);
  assert.equal(pixelsToMinutes(HOUR + 6, HOUR), 60); // 6.4 min rounds down
  assert.equal(pixelsToMinutes(HOUR + 8, HOUR), 75); // 8.6 min rounds up
});

test("a start never crosses midnight in either direction", () => {
  assert.equal(pixelsToMinutes(-40, HOUR), 0);
  assert.equal(pixelsToMinutes(24 * HOUR + 200, HOUR), LATEST_START);
  assert.equal(minutesToTime(LATEST_START), "23:45");
  assert.equal(snapMinutes(24 * 60), LATEST_START);
  assert.equal(minutesToTime(0), "00:00");
});

test("columns: inside, on a boundary, and off either edge", () => {
  assert.equal(columnAt(0, 700, 7), 0);
  assert.equal(columnAt(99, 700, 7), 0);
  assert.equal(columnAt(100, 700, 7), 1);
  assert.equal(columnAt(-50, 700, 7), 0);
  assert.equal(columnAt(9000, 700, 7), 6);
  assert.equal(columnAt(10, 0, 7), 0);
});

test("drop target keeps the grab offset and picks the day", () => {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04"];
  assert.deepEqual(dropTarget({ x: 150, y: HOUR * 9 + 20, grabY: 20, gridWidth: 300, hourPx: HOUR, days }), { ymd: "2026-11-03", minutes: 540 });
  // Grabbed low, dragged to the very top: 12:00 AM, not the day before.
  assert.deepEqual(dropTarget({ x: 299, y: 5, grabY: 30, gridWidth: 300, hourPx: HOUR, days }), { ymd: "2026-11-04", minutes: 0 });
});

test("Canvas, due dates and School Blocks can't be dragged", () => {
  const base = { id: "t", title: "Essay", date: "2026-11-03", time: "15:00", completed: false } as unknown as Task;
  assert.equal(canDragTask(base), true);
  assert.equal(canDragTask({ ...base, source: "canvas" } as Task), false);
  assert.equal(canDragTask({ ...base, time: "23:59" }), false);
  assert.equal(canDragTask({ ...base, title: "School", kind: "school", recurring: { enabled: true, parentId: "p" } } as unknown as Task), false);
});

test("overlap finds another block in the window, never the moved task", () => {
  const tasks = [{ id: "a", time: "15:00" }, { id: "b", time: "16:00" }];
  assert.equal(overlapAt(tasks, "a", 900, 45), null);
  assert.equal(overlapAt(tasks, "a", 930, 45)?.id, "b");
  assert.equal(overlapAt(tasks, "x", 930, 45)?.id, "a");
  assert.equal(overlapAt(tasks, "b", 945, 45), null); // exactly a block away from a
});

test("keyboard nudges stop at the edges", () => {
  assert.deepEqual(nudge(2, 60, "ArrowUp", 7), { dayIndex: 2, minutes: 45 });
  assert.equal(nudge(2, 0, "ArrowUp", 7), null);
  assert.equal(nudge(2, LATEST_START, "ArrowDown", 7), null);
  assert.equal(nudge(0, 60, "ArrowLeft", 7), null);
  assert.deepEqual(nudge(5, 60, "ArrowRight", 7), { dayIndex: 6, minutes: 60 });
  assert.equal(nudge(6, 60, "ArrowRight", 7), null);
  assert.equal(nudge(1, 60, "Enter", 7), null);
});
});
