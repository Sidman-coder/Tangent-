// Run with `npm test`. Same resolve hook as schedule-slots.test.ts: the app
// imports without file extensions, which plain Node cannot resolve.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
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

type Load = typeof import("./load");
void (import("./load") as Promise<Load>).then(
  ({ DEFAULT_CAPACITY: cap, estimateMinutes, minutesFromNotes, placeTask, spreadSessions, suggestRelief, dayLoad, formatMinutes }) => {
    let n = 0;
    const task = (p: Partial<Task> & Pick<Task, "date">): Task => ({
      id: `t${n++}`,
      title: "Something",
      time: "16:00",
      completed: false,
      ...p,
    });
    const school = (date: string): Task =>
      task({ title: "School", kind: "school", date, time: "08:00", notes: "Until 3:00 PM" });
    /** `hours` of homework on `date`, as 1-hour tasks spread through the evening. */
    const busy = (date: string, hours: number): Task[] =>
      Array.from({ length: hours }, (_, i) =>
        task({ date, time: `${16 + i}:00`, notes: "TIME: 60 min", title: `hw ${date} ${i}` })
      );

    // 2026-10-12 is a Monday.
    const MON = "2026-10-12";
    const TUE = "2026-10-13";
    const WED = "2026-10-14";
    const THU = "2026-10-15";
    const FRI = "2026-10-16";
    const now = { date: MON, minutes: 7 * 60 };
    const week = [MON, TUE, WED, THU, FRI].map(school);

    test("reads a task's size from its TIME line", () => {
      assert.equal(minutesFromNotes("GOAL: x\nTIME: 45 mins total — 20 reading"), 45);
      assert.equal(minutesFromNotes("TIME: 1.5 hours"), 90);
      assert.equal(minutesFromNotes("no time here"), null);
    });

    test("school itself and done work cost nothing", () => {
      assert.equal(estimateMinutes(school(MON)), 0);
      assert.equal(estimateMinutes(task({ date: MON, completed: true })), 0);
      assert.equal(estimateMinutes(task({ date: MON, kind: "commitment" })), 90);
      assert.equal(dayLoad([...week, ...busy(MON, 2)], MON), 120);
    });

    test("keeps the asked-for day when it has room", () => {
      const p = placeTask([...week, ...busy(TUE, 1)], { now, cap, preferredDate: TUE });
      assert.equal(p?.date, TUE);
      assert.equal(p?.note, undefined);
      assert.ok(p && p.time >= "15:30", "after school");
    });

    test("moves off a full day and says why", () => {
      const tasks = [...week, ...busy(THU, 3)];
      const p = placeTask(tasks, { now, cap, preferredDate: THU, latest: FRI });
      assert.notEqual(p?.date, THU);
      assert.match(p?.note ?? "", /Thursday already has about 3 hrs planned/);
    });

    test("with no day asked for, picks a light day before the deadline", () => {
      const tasks = [...week, ...busy(MON, 2), ...busy(TUE, 2), ...busy(WED, 0)];
      const p = placeTask(tasks, { now, cap, latest: THU });
      assert.equal(p?.date, WED);
    });

    test("never places in the past or sooner than an hour from now", () => {
      const late = { date: MON, minutes: 20 * 60 };
      const p = placeTask(week, { now: late, cap, earliest: "2026-10-01" });
      assert.ok(p && p.date > MON, "today's evening window is gone, so tomorrow");
    });

    test("spreads plan sessions around heavy days without stacking them", () => {
      const tasks = [...week, ...busy(TUE, 3)];
      const out = spreadSessions(tasks, [MON, TUE, WED], { now, cap });
      assert.equal(out.length, 3);
      assert.ok(!out.some((s) => s.date === TUE), "Tuesday is already full");
      const dates = out.map((s) => s.date);
      assert.deepEqual([...dates].sort(), dates, "stays in order");
      assert.equal(new Set(dates).size, 3, "one session per day");
    });

    test("suggests moving a study session off an overloaded day", () => {
      const tasks = [
        ...week,
        ...busy(WED, 3),
        task({ date: WED, time: "19:00", title: "Read ch 5", planId: "p1", notes: "TIME: 45 min" }),
      ];
      const s = suggestRelief(tasks, { now, cap });
      assert.equal(s?.title, "Read ch 5");
      assert.equal(s?.fromDate, WED);
      assert.notEqual(s?.toDate, WED);
      assert.match(s?.message ?? "", /^Wednesday has about 4 hrs planned\. Move "Read ch 5" to \w+day at/);
    });

    test("never suggests moving a Canvas deadline or a practice", () => {
      const tasks = [
        ...week,
        ...Array.from({ length: 4 }, (_, i) => task({ date: WED, source: "canvas", title: `due ${i}`, notes: "TIME: 60 min" })),
        task({ date: WED, kind: "commitment", title: "Robotics" }),
      ];
      assert.equal(suggestRelief(tasks, { now, cap }), null);
    });

    test("formats minutes for people", () => {
      assert.equal(formatMinutes(45), "45 min");
      assert.equal(formatMinutes(60), "1 hr");
      assert.equal(formatMinutes(150), "2.5 hrs");
    });
  }
);
