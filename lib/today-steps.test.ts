// Run with `npm test`. Same resolve hook as schedule-slots.test.ts: the app
// imports without file extensions, which plain Node cannot resolve.
import * as nodeModule from "node:module";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "./types";

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

type Mod = typeof import("./today-steps");
void (import("./today-steps") as Promise<Mod>).then(
  ({
    MAX_AUTO_MOVES,
    canMoveStep,
    cleanSplit,
    fallbackSplit,
    freshStartSteps,
    missedSteps,
    pickTodaySteps,
    placeSmallerSteps,
    planFreshStart,
    planMissReplan,
    planNotToday,
  }) => {
const TODAY = "2026-11-04"; // a Wednesday
const ctx = { now: { date: TODAY, minutes: 15 * 60 }, cap: { weekday: 150, weekend: 240 } } as Parameters<Mod["planMissReplan"]>[1];

let seq = 0;
function task(over: Partial<Task> = {}): Task {
  seq += 1;
  return { id: `t${seq}`, title: `Task ${seq}`, date: TODAY, time: "17:00", completed: false, ...over } as Task;
}

test("shows at most three steps: late first, then today in time order", () => {
  const late = task({ date: "2026-11-02" });
  const evening = task({ time: "19:00" });
  const afternoon = task({ time: "16:00" });
  const night = task({ time: "21:00" });
  assert.deepEqual(
    pickTodaySteps([night, evening, afternoon, late], TODAY).map((t) => t.id),
    [late.id, afternoon.id, evening.id]
  );
});

test("skips finished work, fixed events, future work and what was set aside", () => {
  const open = task();
  const steps = pickTodaySteps(
    [open, task({ completed: true }), task({ kind: "commitment" }), task({ kind: "school" }), task({ date: "2026-11-05" })],
    TODAY
  );
  assert.deepEqual(steps.map((t) => t.id), [open.id]);
  assert.deepEqual(pickTodaySteps([open], TODAY, new Set([open.id])), []);
});

test("Canvas due soon fills spare room, and a real due date leads its day", () => {
  const soon = task({ source: "canvas", kind: "school", date: "2026-11-06", time: "23:59" });
  const far = task({ source: "canvas", kind: "school", date: "2026-11-07", time: "23:59" });
  const dueToday = task({ source: "canvas", kind: "school", time: "23:59" });
  const chore = task({ time: "16:00" });
  assert.deepEqual(
    pickTodaySteps([chore, far, soon, dueToday], TODAY).map((t) => t.id),
    [dueToday.id, chore.id, soon.id]
  );
});

test("real dates can't move", () => {
  assert.equal(canMoveStep(task()), true);
  assert.equal(canMoveStep(task({ source: "canvas" })), false);
  assert.equal(canMoveStep(task({ time: "23:59" })), false);
  assert.equal(canMoveStep(task({ kind: "commitment" })), false);
  assert.equal(canMoveStep(task({ recurring: { enabled: true } } as Partial<Task>)), false);
});

test("a miss is only a step from an earlier day", () => {
  const yesterday = task({ date: "2026-11-03" });
  assert.deepEqual(
    missedSteps([yesterday, task({ time: "08:00" }), task({ source: "canvas", date: "2026-11-03" })], TODAY).map((t) => t.id),
    [yesterday.id]
  );
});

test("the re-plan moves a miss to today or later and is idempotent", () => {
  const missed = task({ date: "2026-11-03" });
  const { moves, backlog } = planMissReplan([missed], ctx);
  assert.equal(backlog, false);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].fromDate, "2026-11-03");
  assert.ok(moves[0].date >= TODAY);
  const after = { ...missed, date: moves[0].date, time: moves[0].time };
  assert.deepEqual(planMissReplan([after], ctx).moves, []);
});

test("the re-plan keeps a project in order and pushes only what it must", () => {
  const first = task({ planId: "p", date: "2026-11-03" });
  const second = task({ planId: "p", date: TODAY });
  const later = task({ planId: "p", date: "2026-11-20" });
  const other = task({ planId: "q", date: TODAY });
  const { moves } = planMissReplan([first, second, later, other], ctx);
  const moved = new Map(moves.map((m) => [m.taskId, m]));
  assert.equal(moved.has(later.id), false);
  assert.equal(moved.has(other.id), false);
  assert.ok(moved.has(second.id));
  assert.ok(moved.get(first.id)!.date < moved.get(second.id)!.date);
});

test("a backlog isn't reshuffled automatically", () => {
  const many = Array.from({ length: MAX_AUTO_MOVES + 1 }, () => task({ date: "2026-11-01" }));
  assert.deepEqual(planMissReplan(many, ctx), { moves: [], backlog: true });
  assert.equal(planFreshStart(many, ctx).length, many.length);
});

test("Fresh start clears everything past its time and leaves real dates alone", () => {
  const overdue = task({ date: "2026-10-20" });
  const passed = task({ time: "09:00" });
  const ownDue = task({ date: "2026-11-02", time: "23:59" });
  const canvas = task({ source: "canvas", kind: "school", date: "2026-11-03", time: "23:59" });
  const event = task({ kind: "commitment", date: "2026-11-02" });
  const ahead = task({ time: "18:00" });
  const all = [overdue, passed, ownDue, canvas, event, ahead];
  assert.deepEqual(freshStartSteps(all, ctx.now).map((t) => t.id).sort(), [overdue.id, passed.id, ownDue.id].sort());
  const moved = planFreshStart(all, ctx);
  assert.ok(moved.every((m) => m.date >= TODAY));
  assert.ok(!moved.some((m) => [canvas.id, event.id].includes(m.taskId)));
});

test("Fresh start with nothing to clear moves nothing", () => {
  assert.deepEqual(planFreshStart([task({ time: "18:00" })], ctx), []);
});

test("Not today lands tomorrow or later and pushes the project's next step", () => {
  const step = task({ planId: "p" });
  const next = task({ planId: "p", date: "2026-11-05" });
  const moves = planNotToday([step, next], step, ctx);
  const moved = new Map(moves.map((m) => [m.taskId, m]));
  assert.ok(moved.get(step.id)!.date >= "2026-11-05");
  assert.ok(moved.get(next.id)!.date > moved.get(step.id)!.date);
});

test("cleanSplit keeps two or three usable pieces and clamps their size", () => {
  assert.deepEqual(
    cleanSplit({ steps: [{ title: " Outline ", minutes: 90 }, { title: "", minutes: 10 }, { title: "Draft", minutes: 1 }] }),
    [
      { title: "Outline", minutes: 30 },
      { title: "Draft", minutes: 5 },
    ]
  );
  assert.equal(cleanSplit({ steps: [{ title: "Only one", minutes: 10 }] }), null);
  assert.equal(cleanSplit("nope"), null);
  assert.equal(cleanSplit(null), null);
  assert.equal(cleanSplit({ steps: Array.from({ length: 5 }, (_, i) => ({ title: `s${i}`, minutes: 10 })) })!.length, 3);
});

test("fallbackSplit always offers something smaller", () => {
  assert.equal(fallbackSplit({ title: "Essay [Eng]" })[0].title, "First 15 minutes of Essay");
  assert.equal(fallbackSplit({ title: "Essay", startAction: "Open the doc" })[0].title, "Open the doc");
});

test("smaller steps start today, stay in order and keep the project", () => {
  const big = task({ planId: "p", calendarId: "c" });
  const pieces = placeSmallerSteps(
    [big],
    big,
    [
      { title: "One", minutes: 15 },
      { title: "Two", minutes: 20 },
    ],
    ctx
  );
  assert.equal(pieces[0].date, TODAY);
  assert.ok(pieces[1].date >= pieces[0].date);
  assert.equal(pieces[0].planId, "p");
  assert.equal(pieces[0].calendarId, "c");
  assert.match(pieces[1].notes ?? "", /TIME: about 20 min/);
});
  }
);
