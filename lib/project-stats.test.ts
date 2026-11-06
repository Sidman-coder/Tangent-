// Run with `npm test`. Same resolve hook as ics.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { StatTask } from "./project-stats";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

// 2026-11-03 is a Tuesday; its week ends Sunday 2026-11-08.
const TODAY = "2026-11-03";
let n = 0;
const step = (date: string, over: Partial<StatTask> = {}): StatTask => ({ id: `t${n++}`, title: "Step", date, time: "16:00", completed: false, ...over });

void (import("./project-stats") as Promise<typeof import("./project-stats")>).then(
  ({ assignmentWeight, bottleneckStep, courseGroups, dueThisWeek, nextDeadline, nextSteps, paceOf, progressOf, recommendedPace, schoolFocus, workloadByWeek }) => {
    test("progress counts done over total and copes with nothing", () => {
      assert.deepEqual(progressOf([step(TODAY, { completed: true }), step(TODAY), step(TODAY)]), { done: 1, total: 3, percent: 33 });
      assert.deepEqual(progressOf([]), { done: 0, total: 0, percent: 0 });
    });

    test("needed pace is the remaining steps spread over the days left", () => {
      // 4 steps, last one 13 days out: 14 days left, so 2 this week.
      const pace = paceOf([step("2026-11-05"), step("2026-11-09"), step("2026-11-12"), step("2026-11-16")], TODAY);
      assert.equal(pace.remaining, 4);
      assert.equal(pace.daysLeft, 14);
      assert.equal(pace.neededThisWeek, 2);
    });

    test("a brand-new plan with nothing due yet is on track", () => {
      assert.equal(paceOf([step("2026-11-10"), step("2026-11-20")], TODAY).status, "On track");
    });

    test("keeping up with what's needed is on track", () => {
      const tasks = [step("2026-11-01", { completed: true }), step("2026-11-02", { completed: true }), step("2026-11-05"), step("2026-11-12")];
      assert.equal(paceOf(tasks, TODAY).status, "On track");
    });

    test("half the needed pace or better is slightly behind; less is behind", () => {
      const needsThree = [step("2026-11-02"), step("2026-11-04"), step("2026-11-05")];
      assert.equal(paceOf(needsThree, TODAY).status, "Behind");
      assert.equal(paceOf([...needsThree, step("2026-11-01", { completed: true })], TODAY).status, "Behind");
      assert.equal(paceOf([...needsThree, step("2026-11-01", { completed: true }), step("2026-11-02", { completed: true })], TODAY).status, "Slightly behind");
    });

    test("done in the last 7 days counts by completion time, and says when it had to guess", () => {
      const late = step("2026-10-01", { completed: true, completedAt: `${TODAY}T15:00:00.000Z` });
      const old = step("2026-11-03", { completed: true, completedAt: "2026-10-20T15:00:00.000Z" });
      const exact = paceOf([late, old, step("2026-11-12")], TODAY);
      assert.equal(exact.doneLast7, 1);
      assert.equal(exact.approximate, false);
      const guessed = paceOf([step("2026-11-02", { completed: true }), step("2026-11-12")], TODAY);
      assert.equal(guessed.doneLast7, 1);
      assert.equal(guessed.approximate, true);
    });

    test("finished projects and undated steps never read as behind", () => {
      assert.equal(paceOf([step("2026-10-01", { completed: true })], TODAY).status, "On track");
      const undated = paceOf([step("")], TODAY);
      assert.equal(undated.status, "On track");
      assert.equal(undated.daysLeft, null);
    });

    test("an overdue last step leaves one day, not a negative", () => {
      assert.equal(paceOf([step("2026-10-20")], TODAY).daysLeft, 1);
    });

    test("next steps are the soonest three, undated last", () => {
      const a = step("2026-11-09"), b = step("2026-11-04"), c = step(""), d = step("2026-11-05"), e = step("2026-11-02", { completed: true });
      assert.deepEqual(nextSteps([a, b, c, d, e]).map((t) => t.id), [b.id, d.id, a.id]);
    });

    test("next deadline prefers one ahead over one missed", () => {
      const late = step("2026-10-30"), soon = step("2026-11-06");
      assert.equal(nextDeadline([late, soon], TODAY)?.id, soon.id);
      assert.equal(nextDeadline([late], TODAY)?.id, late.id);
      assert.equal(nextDeadline([], TODAY), null);
    });

    test("the recommended sentence sizes sessions to the work", () => {
      assert.equal(recommendedPace([step("2026-11-05", { notes: "TIME: 90 mins" })], TODAY), "About 3 sessions of 30 min this week keeps you on track.");
      assert.equal(recommendedPace([step("2026-11-05", { notes: "TIME: 30 mins" })], TODAY), "About 1 session of 30 min this week keeps you on track.");
      assert.equal(recommendedPace([step(TODAY, { completed: true })], TODAY), "Nothing left to do here.");
    });

    test("workload buckets run to Sunday, then whole weeks, with overdue in the first", () => {
      const weeks = workloadByWeek([step("2026-10-30"), step("2026-11-08"), step("2026-11-09"), step("2026-11-22"), step("2026-11-25"), step("2026-12-20")], TODAY);
      assert.deepEqual(weeks.map((w) => w.count), [2, 1, 1, 1]);
      assert.deepEqual(weeks.map((w) => [w.start, w.end]), [
        ["2026-11-03", "2026-11-08"],
        ["2026-11-09", "2026-11-15"],
        ["2026-11-16", "2026-11-22"],
        ["2026-11-23", "2026-11-29"],
      ]);
      assert.deepEqual(weeks.map((w) => w.label).slice(0, 3), ["This week", "Next week", "Nov 16"]);
    });

    test("done and undated steps add no load", () => {
      const weeks = workloadByWeek([step("2026-11-04", { completed: true }), step("")], TODAY);
      assert.ok(weeks.every((w) => w.count === 0 && w.minutes === 0));
    });

    test("the bottleneck is the most overdue step, else the biggest one soon", () => {
      const late = step("2026-10-20", { title: "Late" });
      assert.equal(bottleneckStep([step("2026-11-05"), late], TODAY)?.title, "Late");
      const big = step("2026-11-10", { title: "Big", notes: "TIME: 120 mins" });
      assert.equal(bottleneckStep([step("2026-11-05", { notes: "TIME: 20 mins" }), big], TODAY)?.title, "Big");
      assert.equal(bottleneckStep([], TODAY), null);
    });

    test("an assignment pulls harder the nearer and longer it is", () => {
      assert.ok(assignmentWeight(60, 1) > assignmentWeight(60, 5));
      assert.ok(assignmentWeight(120, 3) > assignmentWeight(60, 3));
      assert.equal(assignmentWeight(60, -4), assignmentWeight(60, 0));
    });

    const canvas = (title: string, date: string, over: Partial<StatTask> = {}) => step(date, { title, source: "canvas", ...over });

    test("assignments group by course, soonest course first", () => {
      const groups = courseGroups([canvas("Essay [English 10]", "2026-11-20"), canvas("Lab [AP Chem]", "2026-11-05"), canvas("Quiz [AP Chem]", "2026-11-07"), canvas("Old [AP Chem]", "2026-10-01", { completed: true })], TODAY);
      assert.equal(groups.length, 2);
      assert.equal(groups[0].open.length, 2);
      assert.equal(groups[0].dueThisWeek, 2);
      assert.equal(groups[1].dueThisWeek, 0);
    });

    test("School's focus weighs nearness and workload", () => {
      const focus = schoolFocus([canvas("Essay [English 10]", "2026-11-13"), canvas("Lab [AP Chem]", "2026-11-04"), canvas("Quiz [AP Chem]", "2026-11-06")], TODAY);
      assert.ok(focus?.title.includes("Lab"), focus?.title);
      assert.ok(focus?.why.startsWith("2 due"), focus?.why);
    });

    test("a big assignment can outweigh a small nearer one", () => {
      const focus = schoolFocus([canvas("Worksheet [English 10]", "2026-11-04", { notes: "TIME: 10 mins" }), canvas("Project [AP Chem]", "2026-11-05", { notes: "TIME: 240 mins" })], TODAY);
      assert.ok(focus?.title.includes("Project"), focus?.title);
    });

    test("nothing due soon means no School focus", () => {
      assert.equal(schoolFocus([canvas("Far [AP Chem]", "2027-02-01")], TODAY), null);
    });

    test("due this week includes overdue work", () => {
      assert.equal(dueThisWeek([step("2026-10-30"), step("2026-11-08"), step("2026-11-09"), step("2026-11-04", { completed: true })], TODAY), 2);
    });
  }
);
