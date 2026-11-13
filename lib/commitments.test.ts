// Run with `npm test`. "When are you already busy?" (lib/commitments.ts) and
// how its blocks keep planning out (lib/schedule-slots.ts).
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

type Commitments = typeof import("./commitments");
type Slots = typeof import("./schedule-slots");
const load = Promise.all([import("./commitments"), import("./schedule-slots")]) as Promise<[Commitments, Slots]>;

// 2026-11-09 is a Monday.
const TODAY = "2026-11-09";

void load.then(([cm, slots]) => {
  const withIds = (list: Omit<Task, "id">[]): Task[] => list.map((t, i) => ({ ...t, id: `t${i}` }));

  test("a school day plus a Wednesday practice parses into one commitment with two blocks", () => {
    const [c] = cm.parseCommitments([
      {
        kind: "school",
        name: "",
        repeat: { kind: "weekdays" },
        blocks: [
          { days: [1, 2, 3, 4, 5], start: "07:45", end: "14:50" },
          { days: [3], start: "15:30", end: "17:30" },
        ],
      },
    ])!;
    assert.equal(c.name, "School");
    assert.equal(c.blocks.length, 2);
    assert.equal(cm.summarizeCommitment(c), "School · Every weekday · Mon–Fri 7:45 AM – 2:50 PM + Wed 3:30 – 5:30 PM");
  });

  test("bad blocks are dropped, and a commitment with none left is dropped", () => {
    const list = cm.parseCommitments([
      { kind: "practice", repeat: { kind: "weekly" }, blocks: [{ days: [], start: "15:00", end: "16:00" }] },
      { kind: "work", repeat: { kind: "weekly" }, blocks: [{ days: [6], start: "14:00", end: "10:00" }, { days: [6], start: "10:00", end: "14:00" }] },
      { kind: "nope", name: "  Robotics   club ", repeat: { kind: "custom", everyWeeks: 40 }, blocks: [{ days: [9, 2, 2], start: "16:00", end: "18:00" }] },
    ])!;
    assert.deepEqual(
      list.map((c) => [c.kind, c.name, c.blocks.length]),
      [
        ["work", "Work", 1],
        ["other", "Robotics club", 1],
      ]
    );
    assert.deepEqual(list[1].repeat, { kind: "custom", everyWeeks: 8 });
    assert.deepEqual(list[1].blocks[0].days, [2]);
    assert.equal(cm.parseCommitments("nope"), null);
  });

  test("an Other commitment needs a name before it can be saved", () => {
    const c = cm.newCommitment("other");
    assert.equal(cm.commitmentProblem(c), "Give it a name.");
    assert.equal(cm.commitmentProblem({ ...c, name: "Youth group" }), null);
  });

  test("every weekday never lands on a weekend, even if Saturday was ticked", () => {
    const dates = cm.blockDates({ kind: "weekdays" }, { days: [1, 2, 3, 4, 5, 6], start: "08:00", end: "15:00" }, TODAY, "2026-11-15");
    assert.deepEqual(dates, ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
  });

  test("every 2 weeks counts from the week it was saved", () => {
    const dates = cm.blockDates({ kind: "biweekly" }, { days: [3], start: "16:00", end: "17:00" }, TODAY, "2026-12-10");
    assert.deepEqual(dates, ["2026-11-11", "2026-11-25", "2026-12-09"]);
  });

  test("monthly lands on the 1st Saturday, or the last one", () => {
    const block = { days: [6], start: "09:00", end: "12:00" };
    assert.deepEqual(cm.blockDates({ kind: "monthly", week: 1 }, block, TODAY, "2027-01-31"), ["2026-12-05", "2027-01-02"]);
    assert.deepEqual(cm.blockDates({ kind: "monthly", week: -1 }, block, TODAY, "2027-01-31"), ["2026-11-28", "2026-12-26", "2027-01-30"]);
  });

  test("commitments go on the calendar as fixed busy tasks and read back exactly", () => {
    const list = cm.parseCommitments([
      { kind: "school", repeat: { kind: "weekdays" }, blocks: [{ days: [1, 2, 3, 4, 5], start: "07:45", end: "14:50" }] },
      {
        kind: "practice",
        name: "Soccer",
        repeat: { kind: "biweekly" },
        blocks: [
          { days: [1, 3], start: "15:30", end: "17:30" },
          { days: [6], start: "09:00", end: "11:00" },
        ],
      },
      { kind: "family", repeat: { kind: "monthly", week: 1 }, blocks: [{ days: [0], start: "12:00", end: "14:00" }] },
    ])!;
    const tasks = withIds(cm.commitmentTasks(list, TODAY, "abc123"));
    const school = tasks.filter((t) => t.title === "School");
    assert.equal(school.length, 16 * 5 + 1); // 16 weeks of weekdays, plus the Monday at the end
    assert.deepEqual([school[0].kind, school[0].calendarId, school[0].commitment, school[0].notes], ["school", "cal_school", "fixed", "Until 2:50 PM"]);
    const soccer = tasks.find((t) => t.title === "Soccer")!;
    assert.deepEqual([soccer.kind, soccer.calendarId, soccer.notes], ["commitment", "cal_other", "Until 5:30 PM"]);
    assert.ok(tasks.every(cm.isCommitmentTask));

    const back = cm.commitmentsFromTasks([...tasks].reverse());
    assert.deepEqual(
      back.map(({ id: _id, ...c }) => c),
      list
    );
    assert.ok(back.every((c) => c.id?.startsWith("cmt_abc123_")));
  });

  test("a School block from before commitments becomes a School commitment", () => {
    const c = cm.commitmentFromSchool({ days: [5, 1, 2, 3, 4], start: "08:00", end: "15:00" });
    assert.deepEqual(c.repeat, { kind: "weekdays" });
    assert.deepEqual(c.blocks[0].days, [1, 2, 3, 4, 5]);
    assert.deepEqual(cm.commitmentFromSchool({ days: [1, 3], start: "08:00", end: "12:00" }).repeat, { kind: "weekly" });
  });

  test("the saved fact reads in the second person", () => {
    const [practice] = cm.parseCommitments([
      { kind: "practice", repeat: { kind: "biweekly" }, blocks: [{ days: [1, 3], start: "15:30", end: "17:30" }] },
    ])!;
    assert.equal(cm.commitmentFact(practice), "You're busy with Practice every 2 weeks: Mon, Wed 3:30 – 5:30 PM.");
  });

  test("days read naturally", () => {
    assert.equal(cm.formatDays([5, 4, 3, 2, 1]), "Mon–Fri");
    assert.equal(cm.formatDays([6, 0]), "Weekends");
    assert.equal(cm.formatDays([1, 3]), "Mon, Wed");
  });

  test("a practice block keeps a suggested time out of the whole practice, not just its first 45 minutes", () => {
    const [practice] = cm.parseCommitments([
      { kind: "practice", repeat: { kind: "weekly" }, blocks: [{ days: [1, 2, 3, 4, 5], start: "15:30", end: "19:00" }] },
    ])!;
    const tasks = withIds(cm.commitmentTasks([practice], TODAY, "p1"));
    const picks = slots.suggestSlots(tasks, { date: TODAY, minutes: 8 * 60 });
    const weekday = picks.find((p) => p.date === TODAY);
    assert.ok(weekday, "today still has a slot");
    assert.ok(weekday!.time >= "19:00", `got ${weekday!.time}`);
    assert.ok(tasks.every(slots.isBusyBlock));
  });
});
