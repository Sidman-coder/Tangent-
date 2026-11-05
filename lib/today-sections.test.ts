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

type Mod = typeof import("./today-sections");
void (import("./today-sections") as Promise<Mod>).then(({ groupTodayTasks, overdueStyle, glanceLine }) => {
  const TZ = "America/New_York";
  // Wed, Nov 4 2026, 2:00 PM in New York.
  const NOW = new Date("2026-11-04T19:00:00Z");
  let n = 0;
  const task = (extra: Record<string, unknown>) => ({
    id: `t${++n}`,
    title: "Thing",
    date: "2026-11-04",
    time: "",
    completed: false,
    ...extra,
  });
  const ids = (list: { id: string }[]) => list.map((t) => t.id);

  test("fixed and reminder items today are Must do, timed first", () => {
    const later = task({ commitment: "fixed", time: "16:00" });
    const sooner = task({ commitment: "fixed", time: "15:00" });
    const untimed = task({ commitment: "reminder" });
    const { mustDo } = groupTodayTasks([untimed, later, sooner], NOW, TZ);
    assert.deepEqual(ids(mustDo), [sooner.id, later.id, untimed.id]);
  });

  test("a Canvas item due today is Must do", () => {
    const canvas = task({ source: "canvas", title: "Lab 4", time: "23:59", kind: "school" });
    assert.deepEqual(ids(groupTodayTasks([canvas], NOW, TZ).mustDo), [canvas.id]);
  });

  test("flexible steps today are Today's plan, by time", () => {
    const b = task({ commitment: "flexible", time: "18:00" });
    const a = task({ commitment: "flexible", time: "16:30" });
    const c = task({ commitment: "flexible" });
    assert.deepEqual(ids(groupTodayTasks([c, b, a], NOW, TZ).todaysPlan), [a.id, b.id, c.id]);
  });

  test("earlier overdue fixed items sit on top, newest three, with a count of the rest", () => {
    const today = task({ commitment: "reminder" });
    const old = ["2026-11-03", "2026-11-02", "2026-11-01", "2026-10-30", "2026-10-29"].map((date) =>
      task({ commitment: "reminder", date })
    );
    const groups = groupTodayTasks([today, ...old], NOW, TZ);
    assert.deepEqual(ids(groups.mustDo), [old[0].id, old[1].id, old[2].id, today.id]);
    assert.equal(groups.olderOverdueCount, 2);
  });

  test("soft overdue steps sit at the bottom of Today's plan", () => {
    const missed = task({ commitment: "flexible", date: "2026-11-03", time: "16:00" });
    const today = task({ commitment: "flexible", time: "18:00" });
    assert.deepEqual(ids(groupTodayTasks([missed, today], NOW, TZ).todaysPlan), [today.id, missed.id]);
  });

  test("a dismissed overdue item leaves Must do", () => {
    const gone = task({ commitment: "reminder", date: "2026-11-03", overdueDismissedAt: "2026-11-04T10:00:00Z" });
    const groups = groupTodayTasks([gone], NOW, TZ);
    assert.deepEqual(groups.mustDo, []);
    assert.equal(groups.olderOverdueCount, 0);
  });

  test("done items and School Blocks are in no section", () => {
    const done = task({ commitment: "fixed", completed: true });
    const school = task({
      kind: "school",
      title: "School",
      notes: "Until 3:00 PM",
      time: "08:00",
      recurring: { enabled: true, frequency: "weekly", parentId: "s" },
    });
    const groups = groupTodayTasks([done, school], NOW, TZ);
    assert.deepEqual([groups.mustDo, groups.todaysPlan, groups.comingUp], [[], [], []]);
  });

  test("Coming up holds the next three days, grouped and in order", () => {
    const d3 = task({ commitment: "flexible", date: "2026-11-07" });
    const d1b = task({ commitment: "fixed", date: "2026-11-05", time: "15:00" });
    const d1a = task({ commitment: "flexible", date: "2026-11-05", time: "09:00" });
    const d4 = task({ commitment: "fixed", date: "2026-11-08" });
    const { comingUp } = groupTodayTasks([d3, d1b, d1a, d4], NOW, TZ);
    assert.deepEqual(
      comingUp.map((d) => d.date),
      ["2026-11-05", "2026-11-07"]
    );
    assert.deepEqual(ids(comingUp[0].tasks), [d1a.id, d1b.id]);
  });

  test("today follows the student's timezone", () => {
    // 11:30 PM Nov 3 in Los Angeles is already Nov 4 in New York.
    const at = new Date("2026-11-04T07:30:00Z");
    const t = task({ commitment: "reminder", date: "2026-11-04" });
    assert.deepEqual(ids(groupTodayTasks([t], at, "America/New_York").mustDo), [t.id]);
    assert.deepEqual(groupTodayTasks([t], at, "America/Los_Angeles").mustDo, []);
    assert.equal(groupTodayTasks([t], at, "America/Los_Angeles").comingUp[0].date, "2026-11-04");
  });

  test("a fixed item goes hard once its time has passed", () => {
    assert.equal(overdueStyle(task({ commitment: "fixed", time: "13:30" }), NOW, TZ), "hard");
    assert.equal(overdueStyle(task({ commitment: "fixed", time: "15:30" }), NOW, TZ), null);
  });

  test("an untimed reminder today isn't overdue until tomorrow", () => {
    assert.equal(overdueStyle(task({ commitment: "reminder" }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ commitment: "reminder", date: "2026-11-03" }), NOW, TZ), "hard");
  });

  test("flexible work is never hard", () => {
    assert.equal(overdueStyle(task({ commitment: "flexible", time: "09:00" }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ commitment: "flexible", date: "2026-11-03" }), NOW, TZ), "soft");
  });

  test("a past imported calendar event just happened", () => {
    assert.equal(overdueStyle(task({ commitment: "fixed", time: "09:00", notes: "From school.ics" }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ commitment: "fixed", date: "2026-11-03", notes: "From school.ics" }), NOW, TZ), null);
  });

  test("a Canvas item from an earlier day is hard overdue", () => {
    const canvas = task({ source: "canvas", kind: "school", title: "Lab 4", date: "2026-11-03", time: "23:59" });
    assert.equal(overdueStyle(canvas, NOW, TZ), "hard");
  });

  test("a missed recurring instance or commitment isn't overdue", () => {
    const recurring = { enabled: true, frequency: "daily", parentId: "r" };
    assert.equal(overdueStyle(task({ commitment: "reminder", date: "2026-11-03", recurring }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ commitment: "flexible", date: "2026-11-03", recurring }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ kind: "commitment", title: "Robotics", date: "2026-11-03", time: "16:00" }), NOW, TZ), null);
  });

  test("done or future items aren't overdue", () => {
    assert.equal(overdueStyle(task({ commitment: "fixed", time: "09:00", completed: true }), NOW, TZ), null);
    assert.equal(overdueStyle(task({ commitment: "fixed", date: "2026-11-05" }), NOW, TZ), null);
  });

  test("glance line names the count, the next thing and the plan", () => {
    const dentist = task({ commitment: "fixed", title: "Dentist", time: "15:30" });
    const form = task({ commitment: "reminder", title: "Turn in form" });
    const past = task({ commitment: "fixed", title: "Missed", time: "09:00" });
    const steps = [task({ commitment: "flexible" }), task({ commitment: "flexible" })];
    const groups = groupTodayTasks([dentist, form, past, ...steps], NOW, TZ);
    assert.equal(glanceLine(groups, NOW, TZ), "3 must-dos · next: Dentist at 3:30 PM · 2 plan steps left");
  });

  test("glance line uses singular forms and leaves out empty parts", () => {
    const form = task({ commitment: "reminder", title: "Turn in form" });
    const step = task({ commitment: "flexible" });
    assert.equal(glanceLine(groupTodayTasks([form], NOW, TZ), NOW, TZ), "1 must-do");
    assert.equal(glanceLine(groupTodayTasks([step], NOW, TZ), NOW, TZ), "Nothing you have to do today · 1 plan step left");
    assert.equal(glanceLine(groupTodayTasks([], NOW, TZ), NOW, TZ), "Nothing you have to do today");
  });

  test("glance line counts overdue items past the ones shown", () => {
    const old = ["2026-11-03", "2026-11-02", "2026-11-01", "2026-10-30"].map((date) =>
      task({ commitment: "reminder", date })
    );
    assert.equal(glanceLine(groupTodayTasks(old, NOW, TZ), NOW, TZ), "4 must-dos");
  });
});
