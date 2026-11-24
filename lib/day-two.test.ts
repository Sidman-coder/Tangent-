// Run with `npm test`. Overnight 2 Phase 3: day-2 follow-up end to end on a
// seeded clock. Day 1 (Sun 2026-11-22) the student confirms a plan; day 2
// (Mon 11-23) Home leads with its first step; after Done, day 3 (Tue 11-24)
// the daily bubble asks how it went, once.
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

type Steps = typeof import("./today-steps");
type Fu = typeof import("./student/step-follow-up");
void Promise.all([import("./today-steps") as Promise<Steps>, import("./student/step-follow-up.ts" as string) as Promise<Fu>]).then(
  ([{ dayTwoStep }, { recentStepFollowUp, recentDayWord, stepFollowUpTaskId, stepFollowUpReply }]) => {
    const DAY1 = "2026-11-22";
    const DAY2 = "2026-11-23";
    const DAY3 = "2026-11-24";
    // createdAt is an ISO instant; the test's "local day" is its date part.
    const madeOn = (iso: string) => iso.slice(0, 10);
    const plan = { id: "p1", title: "AP Chem final", createdAt: `${DAY1}T20:15:00.000Z`, kind: null };
    const school = { id: "p2", title: "School", createdAt: `${DAY1}T08:00:00.000Z`, kind: "school" };
    const step = (over: Partial<Task>): Task =>
      ({ id: "s1", title: "Read chapter 4 notes", date: DAY2, time: "16:30", completed: false, planId: "p1", notes: "", ...over }) as Task;

    test("day 1: the plan was made today, so Home adds nothing (the brief already said First up)", () => {
      assert.equal(dayTwoStep([step({ date: DAY1 })], [plan], DAY1, madeOn), null);
    });

    test("day 2: Home leads with the plan's first open step today", () => {
      const tasks = [step({}), step({ id: "s2", title: "Practice problems", date: "2026-11-25", time: "17:00" })];
      const d2 = dayTwoStep(tasks, [plan, school], DAY2, madeOn);
      assert.ok(d2);
      assert.equal(d2.step.id, "s1");
      assert.equal(d2.planTitle, "AP Chem final");
      assert.equal(d2.madeOn, DAY1);
    });

    test("day 2: nothing when the first step is another day, done already, or the plan is School/Work", () => {
      assert.equal(dayTwoStep([step({ date: "2026-11-25" })], [plan], DAY2, madeOn), null);
      assert.equal(dayTwoStep([step({ completed: true })], [plan], DAY2, madeOn), null);
      assert.equal(dayTwoStep([step({ planId: "p2" })], [school], DAY2, madeOn), null);
      // Three days later it's an old plan: the list handles it.
      assert.equal(dayTwoStep([step({ date: "2026-11-25" })], [plan], "2026-11-25", madeOn), null);
    });

    test("day 3: the bubble asks how yesterday's finished step went", () => {
      const fu = recentStepFollowUp([step({ completed: true })], DAY3, []);
      assert.ok(fu);
      assert.equal(fu.ask, "How did “Read chapter 4 notes” go yesterday?");
      assert.equal(stepFollowUpTaskId(fu.id), "s1");
      assert.equal(fu.slotKey, "fuStep");
      assert.match(fu.slotKey, /^[a-zA-Z]{1,32}$/);
    });

    test("the bubble names the day for two days ago and stops after that", () => {
      assert.equal(recentDayWord(DAY2, "2026-11-25"), "on Monday");
      assert.ok(recentStepFollowUp([step({ completed: true })], "2026-11-25", []));
      assert.equal(recentStepFollowUp([step({ completed: true })], "2026-11-26", []), null);
    });

    test("never asks twice: already asked, already checked in, or a HOW IT WENT note", () => {
      const done = step({ completed: true });
      assert.equal(recentStepFollowUp([done], DAY3, ["step-s1"]), null);
      assert.equal(recentStepFollowUp([done], DAY3, [], new Set(["s1"])), null);
      assert.equal(recentStepFollowUp([step({ completed: true, notes: "GOAL: x\nHOW IT WENT: fine" })], DAY3, []), null);
    });

    test("only finished plan steps: not open ones, not today's, not classes or repeats", () => {
      assert.equal(recentStepFollowUp([step({})], DAY3, []), null);
      assert.equal(recentStepFollowUp([step({ completed: true, date: DAY3 })], DAY3, []), null);
      assert.equal(recentStepFollowUp([step({ completed: true, planId: null })], DAY3, []), null);
      assert.equal(recentStepFollowUp([step({ completed: true, kind: "school" } as Partial<Task>)], DAY3, []), null);
      assert.equal(recentStepFollowUp([step({ completed: true, recurring: { enabled: true } } as Partial<Task>)], DAY3, []), null);
    });

    test("the most recent step first", () => {
      const older = step({ id: "old", title: "Older", date: DAY1, completed: true });
      const newer = step({ id: "new", title: "Newer", date: DAY2, completed: true });
      assert.equal(recentStepFollowUp([older, newer], DAY3, [])?.id, "step-new");
      assert.equal(recentStepFollowUp([older, newer], DAY3, ["step-new"])?.id, "step-old");
    });

    test("other follow-up ids aren't step ids; the reply says what was kept", () => {
      assert.equal(stepFollowUpTaskId("fuEnergy"), null);
      assert.equal(stepFollowUpTaskId("step-"), null);
      assert.match(stepFollowUpReply("Read chapter 4 notes", true), /Noted how “Read chapter 4 notes” went/);
      assert.doesNotMatch(stepFollowUpReply("x", false), /Noted/);
    });
  }
);
