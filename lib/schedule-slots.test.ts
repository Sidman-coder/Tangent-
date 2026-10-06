// Run with `npm test` (Node's built-in runner; Node strips the types).
// The app imports without file extensions, which plain Node cannot resolve, so
// a resolve hook adds ".ts" before the modules under test are loaded.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./types";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
// registerHooks is newer than the @types/node this repo pins.
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

type Slots = typeof import("./schedule-slots");
type Format = typeof import("./path-format");
const load = Promise.all([import("./schedule-slots"), import("./path-format")]) as Promise<[Slots, Format]>;

void load.then(([{ suggestSlots, schoolEndFromNotes, isBeforeNow, toMinutes }, { stepTitle, splitNodeDetail }]) => {
let n = 0;
function task(p: Partial<Task> & Pick<Task, "date" | "time">): Task {
  return { id: `t${n++}`, title: "Something", completed: false, ...p };
}

/** A weekly School block the way onboarding writes it. */
function school(date: string, time = "08:00", until = "Until 3:00 PM"): Task {
  return task({ title: "School", kind: "school", date, time, notes: until, calendarId: "cal_personal" });
}

// 2026-09-28 is a Monday.
const MON = "2026-09-28";

test("parses the School block's end time", () => {
  assert.equal(schoolEndFromNotes("Until 3:00 PM"), 15 * 60);
  assert.equal(schoolEndFromNotes("Until 12:30 pm"), 12 * 60 + 30);
  assert.equal(schoolEndFromNotes("Until 12:00 AM"), 0);
  assert.equal(schoolEndFromNotes("Until 2:45 P.M."), 14 * 60 + 45);
  assert.equal(schoolEndFromNotes("bring calculator"), null);
  assert.equal(schoolEndFromNotes(undefined), null);
});

test("weekday slots start after school, not during it", () => {
  const tasks = ["2026-09-28", "2026-09-29", "2026-09-30"].map((d) => school(d, "08:00", "Until 3:45 PM"));
  const slots = suggestSlots(tasks, { date: MON, minutes: 7 * 60 });
  assert.equal(slots.length, 3);
  assert.deepEqual(slots[0], { date: MON, time: "16:30", afterSchool: true });
  for (const s of slots.filter((x) => x.date <= "2026-09-30")) {
    assert.ok(toMinutes(s.time)! >= 16 * 60 + 15, `${s.date} ${s.time} is during school`);
  }
});

test("3:30 PM is the weekday floor even with no School block", () => {
  const slots = suggestSlots([], { date: MON, minutes: 8 * 60 });
  assert.deepEqual(slots[0], { date: MON, time: "15:30", afterSchool: false });
});

test("existing tasks are avoided as 45-minute blocks", () => {
  const tasks = [school(MON), task({ date: MON, time: "15:30" }), task({ date: MON, time: "16:30" })];
  const [first] = suggestSlots(tasks, { date: MON, minutes: 8 * 60 });
  // 15:30 busy to 16:15, 16:00 would overlap 16:30, 16:30 busy to 17:15.
  assert.equal(first.time, "17:30");
});

test("completed tasks and Canvas deadlines do not block time", () => {
  const tasks = [
    school(MON),
    task({ date: MON, time: "15:30", completed: true }),
    task({ date: MON, time: "15:30", kind: "school", source: "canvas", title: "Essay due" }),
  ];
  assert.equal(suggestSlots(tasks, { date: MON, minutes: 8 * 60 })[0].time, "15:30");
});

test("a school-kind task that is not the School block is a normal 45 minutes", () => {
  const tasks = [task({ date: MON, time: "15:30", kind: "school", title: "Math test" })];
  assert.equal(suggestSlots(tasks, { date: MON, minutes: 8 * 60 })[0].time, "16:30");
});

test("a School block without an Until note is assumed to be 7 hours", () => {
  const tasks = [task({ date: MON, time: "09:00", kind: "school", title: "School" })];
  // 9:00 + 7h = 16:00, +30 min gap = 16:30.
  assert.deepEqual(suggestSlots(tasks, { date: MON, minutes: 8 * 60 })[0], { date: MON, time: "16:30", afterSchool: true });
});

test("nothing sooner than an hour from now, and a late evening moves to tomorrow", () => {
  const slots = suggestSlots([], { date: MON, minutes: 17 * 60 + 10 });
  assert.equal(slots[0].date, MON);
  assert.equal(slots[0].time, "18:30");
  const late = suggestSlots([], { date: MON, minutes: 20 * 60 });
  assert.equal(late[0].date, "2026-09-29");
});

test("three different days, and a weekend morning is offered when the week is otherwise weekdays", () => {
  const slots = suggestSlots([], { date: MON, minutes: 8 * 60 });
  assert.equal(new Set(slots.map((s) => s.date)).size, 3);
  assert.deepEqual(slots.map((s) => s.date), ["2026-09-28", "2026-09-29", "2026-10-03"]);
  assert.equal(slots[2].time, "09:30");
});

test("weekend windows skip the middle of the day", () => {
  const sat = "2026-10-03";
  const busyMorning = [9, 10, 11].flatMap((h) => [
    task({ date: sat, time: `${String(h).padStart(2, "0")}:00` }),
    task({ date: sat, time: `${String(h).padStart(2, "0")}:30` }),
  ]);
  const slots = suggestSlots(busyMorning, { date: sat, minutes: 7 * 60 });
  assert.deepEqual(slots[0], { date: sat, time: "14:00", afterSchool: false });
});

test("tasks without a clock time are ignored", () => {
  const tasks = [task({ date: MON, time: "" }), task({ date: MON, time: "all day" })];
  assert.equal(suggestSlots(tasks, { date: MON, minutes: 8 * 60 })[0].time, "15:30");
});

test("a full week returns fewer slots rather than bad ones", () => {
  const tasks: Task[] = [];
  for (let d = 28; d <= 30; d++) for (let h = 9; h < 21; h++) for (const mm of ["00", "30"]) {
    tasks.push(task({ date: `2026-09-${d}`, time: `${String(h).padStart(2, "0")}:${mm}` }));
  }
  for (let d = 1; d <= 5; d++) for (let h = 9; h < 21; h++) for (const mm of ["00", "30"]) {
    tasks.push(task({ date: `2026-10-0${d}`, time: `${String(h).padStart(2, "0")}:${mm}` }));
  }
  assert.deepEqual(suggestSlots(tasks, { date: MON, minutes: 8 * 60 }), []);
});

test("isBeforeNow compares the student's wall clock", () => {
  const now = { date: MON, minutes: 16 * 60 };
  assert.equal(isBeforeNow(MON, "15:59", now), true);
  assert.equal(isBeforeNow(MON, "16:00", now), false);
  assert.equal(isBeforeNow("2026-09-27", "23:00", now), true);
  assert.equal(isBeforeNow("2026-09-29", "08:00", now), false);
});

test("stepTitle cuts at a word boundary and keeps short steps whole", () => {
  assert.equal(stepTitle("Email Coach Ramos."), "Email Coach Ramos");
  const long = "Write down the three openings you lose with most often and pick the one to drill first this week";
  const t = stepTitle(long);
  assert.ok(t.length <= 60, t);
  assert.ok(t.endsWith("…"));
  assert.ok(long.startsWith(t.slice(0, -1)));
  assert.ok(!/\s…$/.test(t));
});

test("splitNodeDetail reads the stored format", () => {
  assert.deepEqual(splitNodeDetail("Do the thing.\n\nFirst step: Open the doc"), {
    summary: "Do the thing.",
    firstStep: "Open the doc",
  });
  assert.deepEqual(splitNodeDetail("Just a note"), { summary: "Just a note", firstStep: "" });
  assert.deepEqual(splitNodeDetail(undefined), { summary: "", firstStep: "" });
});
});
