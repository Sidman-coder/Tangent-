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
void (import("./today-sections") as Promise<Mod>).then(({ groupTodayTasks, overdueStyle, glanceLine, nowLine, dayPartOf, nothingOnDay, goalPlanFor }) => {
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

  // The parts that have anything in them (the four timed parts always show).
  const parts = (groups: { parts: { part: string; tasks: { id: string }[] }[] }) =>
    Object.fromEntries(groups.parts.filter((p) => p.tasks.length > 0).map((p) => [p.part, ids(p.tasks)]));
  const partOf = <G extends { part: string }>(groups: { parts: G[] }, id: string) => groups.parts.find((p) => p.part === id)!;

  test("today's items fall into time-of-day groups, timed first by time", () => {
    const breakfast = task({ commitment: "fixed", time: "07:30" });
    const noon = task({ commitment: "fixed", time: "12:00" });
    const later = task({ commitment: "flexible", time: "16:59" });
    const evening = task({ commitment: "reminder", time: "17:00" });
    const night = task({ commitment: "flexible", time: "22:15" });
    const untimed = task({ commitment: "reminder" });
    const groups = groupTodayTasks([untimed, night, later, evening, noon, breakfast], NOW, TZ);
    assert.deepEqual(parts(groups), {
      morning: [breakfast.id],
      afternoon: [noon.id, later.id],
      evening: [evening.id],
      night: [night.id],
      anytime: [untimed.id],
    });
  });

  test("Morning, Afternoon, Evening and Late night always show; Anytime only when used", () => {
    const groups = groupTodayTasks([task({ commitment: "flexible", time: "18:00" })], NOW, TZ);
    assert.deepEqual(groups.parts.map((p) => [p.part, p.tasks.length]), [
      ["morning", 0],
      ["afternoon", 0],
      ["evening", 1],
      ["night", 0],
    ]);
    assert.equal(nothingOnDay(groups), false);
    assert.equal(nothingOnDay(groupTodayTasks([], NOW, TZ)), true);
  });

  test("Late night runs to 5 AM, so 1 AM comes after 11 PM", () => {
    const one = task({ commitment: "flexible", time: "01:00" });
    const eleven = task({ commitment: "flexible", time: "23:00" });
    const early = task({ commitment: "flexible", time: "05:00" });
    assert.deepEqual(parts(groupTodayTasks([one, early, eleven], NOW, TZ)), {
      morning: [early.id],
      night: [eleven.id, one.id],
    });
  });

  test("inside a group, work sits under its project, School or Personal", () => {
    const bio1 = task({ commitment: "flexible", time: "15:00", planId: "bio" });
    const canvas = task({ source: "canvas", kind: "school", title: "Lab 4", time: "15:30" });
    const bio2 = task({ commitment: "flexible", time: "16:00", planId: "bio" });
    const gym = task({ commitment: "fixed", time: "16:30" });
    const afternoon = partOf(groupTodayTasks([gym, bio2, canvas, bio1], NOW, TZ), "afternoon");
    assert.deepEqual(
      afternoon.blocks.map((b) => [b.kind, b.planId, ids(b.tasks)]),
      [
        ["project", "bio", [bio1.id, bio2.id]],
        ["school", null, [canvas.id]],
        ["personal", null, [gym.id]],
      ]
    );
    assert.deepEqual(ids(afternoon.tasks), [bio1.id, bio2.id, canvas.id, gym.id]);
  });

  test("a goal's own task goes under the project made for it, not Personal", () => {
    const plans = [
      { id: "p1", title: "Get 10k followers" },
      { id: "p2", title: "Learn guitar" },
    ];
    const goal = task({ commitment: "flexible", time: "15:00", title: "Break down plan: Get 10k followers" });
    assert.equal(goalPlanFor(goal, plans)?.id, "p1");
    assert.equal(goalPlanFor({ title: "Plan - learn guitar basics" }, plans)?.id, "p2");
    assert.equal(goalPlanFor({ title: "Get 10k followers" }, plans), null);
    assert.equal(goalPlanFor({ title: "Break down plan: Bake bread" }, plans), null);
    const [block] = partOf(groupTodayTasks([goal], NOW, TZ, plans), "afternoon").blocks;
    assert.deepEqual([block.kind, block.planId], ["project", "p1"]);
  });

  test("a step scheduled from a Path sits under that Path's name", () => {
    const step = task({
      commitment: "flexible",
      time: "15:00",
      pathOrigin: { pathId: "path1", pathTitle: "Start a podcast", nodeTitle: "Record episode 1" },
    });
    const [block] = partOf(groupTodayTasks([step], NOW, TZ), "afternoon").blocks;
    assert.deepEqual([block.key, block.kind, block.title], ["path:path1", "project", "Start a podcast"]);
  });

  test("done items stay in place, faded, and don't count as left", () => {
    const done = task({ commitment: "fixed", time: "09:00", completed: true });
    const open = task({ commitment: "flexible", time: "10:00" });
    const groups = groupTodayTasks([open, done], NOW, TZ);
    assert.deepEqual(parts(groups), { morning: [done.id, open.id] });
    assert.equal(partOf(groups, "morning").open, 1);
    assert.deepEqual(groups.counts, { left: 1, must: 0, pastDue: 0, done: 1 });
  });

  test("Past due holds the last three days, newest first, with a count of older ones", () => {
    const fixed = task({ commitment: "reminder", date: "2026-11-03" });
    const slipped = task({ commitment: "flexible", date: "2026-11-02", time: "16:00" });
    const edge = task({ commitment: "fixed", date: "2026-11-01" });
    const old = ["2026-10-31", "2026-10-20"].map((date) => task({ commitment: "reminder", date }));
    const oldStep = task({ commitment: "flexible", date: "2026-10-30" });
    const groups = groupTodayTasks([edge, ...old, oldStep, slipped, fixed], NOW, TZ);
    assert.deepEqual(ids(groups.pastDue), [fixed.id, slipped.id, edge.id]);
    assert.equal(groups.olderPastDueCount, 3);
    assert.equal(groups.counts.pastDue, 6);
  });

  test("a dismissed, done or recurring earlier item isn't past due", () => {
    const gone = task({ commitment: "reminder", date: "2026-11-03", overdueDismissedAt: "2026-11-04T10:00:00Z" });
    const done = task({ commitment: "fixed", date: "2026-11-03", completed: true });
    const recurring = task({ commitment: "reminder", date: "2026-11-03", recurring: { enabled: true, frequency: "daily", parentId: "r" } });
    const groups = groupTodayTasks([gone, done, recurring], NOW, TZ);
    assert.deepEqual(groups.pastDue, []);
    assert.equal(groups.olderPastDueCount, 0);
  });

  test("School Blocks are in no group", () => {
    const school = task({
      kind: "school",
      title: "School",
      notes: "Until 3:00 PM",
      time: "08:00",
      recurring: { enabled: true, frequency: "weekly", parentId: "s" },
    });
    const groups = groupTodayTasks([school], NOW, TZ);
    assert.equal(nothingOnDay(groups), true);
    assert.deepEqual([groups.pastDue, groups.comingUp], [[], []]);
  });

  test("Coming up holds the next three days, grouped and in order, without done items", () => {
    const d3 = task({ commitment: "flexible", date: "2026-11-07" });
    const d1b = task({ commitment: "fixed", date: "2026-11-05", time: "15:00" });
    const d1a = task({ commitment: "flexible", date: "2026-11-05", time: "09:00" });
    const d1done = task({ commitment: "flexible", date: "2026-11-05", completed: true });
    const d4 = task({ commitment: "fixed", date: "2026-11-08" });
    const { comingUp } = groupTodayTasks([d3, d1b, d1a, d1done, d4], NOW, TZ);
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
    assert.deepEqual(parts(groupTodayTasks([t], at, "America/New_York")), { anytime: [t.id] });
    assert.deepEqual(parts(groupTodayTasks([t], at, "America/Los_Angeles")), {});
    assert.equal(groupTodayTasks([t], at, "America/Los_Angeles").comingUp[0].date, "2026-11-04");
  });

  test("the Now line sits in the current part, before its first item that hasn't started", () => {
    const done = task({ commitment: "fixed", time: "09:00", completed: true });
    const lunch = task({ commitment: "fixed", time: "12:30" });
    const next = task({ commitment: "flexible", time: "14:00" });
    const evening = task({ commitment: "flexible", time: "19:00" });
    const groups = groupTodayTasks([evening, next, lunch, done, task({})], NOW, TZ);
    assert.deepEqual(nowLine(groups, NOW, TZ), { part: "afternoon", before: next.id });
  });

  test("the Now line stays in the current part when the next item is later in the day", () => {
    const morning = task({ commitment: "fixed", time: "09:00" });
    const evening = task({ commitment: "flexible", time: "19:00" });
    const groups = groupTodayTasks([morning, evening, task({})], NOW, TZ);
    assert.deepEqual(nowLine(groups, NOW, TZ), { part: "afternoon", before: null });
  });

  test("the Now line shows on an empty day too", () => {
    assert.deepEqual(nowLine(groupTodayTasks([], NOW, TZ), NOW, TZ), { part: "afternoon", before: null });
  });

  test("at 12:15 AM the Now line is in Late night", () => {
    const at = new Date("2026-11-04T05:15:00Z"); // 12:15 AM in New York
    const one = task({ commitment: "flexible", time: "01:00" });
    const breakfast = task({ commitment: "fixed", time: "08:00" });
    const groups = groupTodayTasks([breakfast, one], at, TZ);
    assert.deepEqual(nowLine(groups, at, TZ), { part: "night", before: one.id });
  });

  test("dayPartOf reads 24-hour times, runs 5 AM to 5 AM and treats no time as Anytime", () => {
    assert.deepEqual(["00:00", "04:59", "05:00", "11:59", "12:00", "16:59", "17:00", "20:59", "21:00", "23:59", ""].map(dayPartOf), [
      "night",
      "night",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
      "anytime",
    ]);
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

  test("glance line names what's left, what's past due and the next fixed thing", () => {
    const dentist = task({ commitment: "fixed", title: "Dentist", time: "15:30" });
    const form = task({ commitment: "reminder", title: "Turn in form" });
    const past = task({ commitment: "fixed", title: "Missed", time: "09:00" });
    const step = task({ commitment: "flexible", time: "14:30" });
    const late = task({ commitment: "reminder", date: "2026-11-03" });
    const groups = groupTodayTasks([dentist, form, past, step, late], NOW, TZ);
    assert.equal(glanceLine(groups, NOW, TZ), "4 left today · 1 past due · next: Dentist at 3:30 PM");
  });

  test("glance line for an empty day and a finished one", () => {
    assert.equal(glanceLine(groupTodayTasks([], NOW, TZ), NOW, TZ), "Nothing planned today");
    const done = task({ commitment: "flexible", completed: true });
    assert.equal(glanceLine(groupTodayTasks([done], NOW, TZ), NOW, TZ), "All done for today");
  });

  test("glance line counts past due items older than the ones shown", () => {
    const old = ["2026-11-03", "2026-11-02", "2026-11-01", "2026-10-30"].map((date) =>
      task({ commitment: "reminder", date })
    );
    assert.equal(glanceLine(groupTodayTasks(old, NOW, TZ), NOW, TZ), "Nothing planned today · 4 past due");
  });
});
