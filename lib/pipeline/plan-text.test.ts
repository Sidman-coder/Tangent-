// Run with `npm test` (Node's built-in runner; Node strips the types).
// A resolve hook adds ".ts" to the app's extensionless imports.
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

type PT = typeof import("./plan-text");
type DR = typeof import("./draft");

void Promise.all([import("./plan-text") as Promise<PT>, import("./draft") as Promise<DR>]).then(([pt, dr]) => {
  const { parsePlanText, skippedNotes, countScheduleLines, parseDayLabel, parseTimeLabel, stripModeSwitchLine, isAddShownPlan } = pt;
  const TODAY = "2026-10-26"; // a Monday

  // Format 1: the Plan prompt's own shape, em dashes, dates crossing into November.
  const EM_DASH_REPLY = [
    "Here's a two-week ICF prep plan:",
    "",
    "**Week 1: Research**",
    "- Mon, Oct 26 — 4:00 PM — Pick your project topic",
    "- Wed, Oct 28 — 4:30 PM — Read two background articles",
    "- Fri, Oct 30 — 5:00 PM — Outline the problem statement",
    "",
    "**Week 2: Build**",
    "- Mon, Nov 2 — 4:00 PM — Sketch the prototype",
    "- Wed, Nov 4 — 4:00 PM — Draft the pitch: problem, solution, impact",
    "",
    "Switch to Calendar and say \"add this plan\" to put these on your calendar.",
  ].join("\n");

  // Format 2: numbered list, numeric dates, hyphen/en dash separators, time ranges.
  const RANGE_REPLY = [
    "SAT study block plan",
    "1. 10/27 - 4-5pm - Reading section practice",
    "2. 10/29 – 11-1pm – Full math section",
    "3. 10/31 | 9:00 AM | Timed practice test",
    "4. 11/01 - 3 - Review mistakes",
  ].join("\n");

  // Format 3: weekdays with no times at all.
  const NO_TIME_REPLY = [
    "A light plan for this week:",
    "Tuesday: Review chapter 4 notes",
    "Thursday: Do the practice problems",
    "Saturday: Rest, then quiz yourself for 20 minutes",
    "Remember to take breaks!",
  ].join("\n");

  test("em dash reply: every line read, dates cross into the next month", () => {
    const r = parsePlanText(EM_DASH_REPLY, TODAY);
    assert.equal(r.total, 5);
    assert.deepEqual(r.skipped, []);
    assert.deepEqual(r.tasks, [
      { title: "Pick your project topic", date: "2026-10-26", time: "16:00" },
      { title: "Read two background articles", date: "2026-10-28", time: "16:30" },
      { title: "Outline the problem statement", date: "2026-10-30", time: "17:00" },
      { title: "Sketch the prototype", date: "2026-11-02", time: "16:00" },
      { title: "Draft the pitch: problem, solution, impact", date: "2026-11-04", time: "16:00" },
    ]);
    assert.deepEqual(skippedNotes(r), []);
  });

  test("range reply: ranges read as start time; an unreadable line is listed, never dropped", () => {
    const r = parsePlanText(RANGE_REPLY, TODAY);
    assert.equal(r.total, 4);
    assert.deepEqual(r.tasks, [
      { title: "Reading section practice", date: "2026-10-27", time: "16:00" },
      { title: "Full math section", date: "2026-10-29", time: "11:00" },
      { title: "Timed practice test", date: "2026-10-31", time: "09:00" },
    ]);
    // "3" could be 3 PM or part of the title: listed on the card, never dropped.
    assert.deepEqual(r.skipped, ["11/01 - 3 - Review mistakes"]);
    assert.deepEqual(skippedNotes(r), ["Read 3 of 4 lines", "Skipped: 11/01 - 3 - Review mistakes"]);
  });

  test("no-time reply: weekdays resolve on or after today, times empty", () => {
    const r = parsePlanText(NO_TIME_REPLY, TODAY);
    assert.equal(r.total, 3);
    assert.deepEqual(r.tasks, [
      { title: "Review chapter 4 notes", date: "2026-10-27", time: "" },
      { title: "Do the practice problems", date: "2026-10-29", time: "" },
      { title: "Rest, then quiz yourself for 20 minutes", date: "2026-10-31", time: "" },
    ]);
  });

  test("skipped lines: card says Read X of Y and lists each one", () => {
    const reply = [
      "- Mon, Oct 26 — 4:00 PM — Pick a topic",
      "- Feb 30 — 4:00 PM — Impossible date",
      "- Tue, Oct 27 — 25:00 — Bad time",
      "- Wed, Oct 28 — 4:00 PM — Read articles",
    ].join("\n");
    const r = parsePlanText(reply, TODAY);
    assert.equal(r.total, 4);
    assert.equal(r.tasks.length, 2);
    assert.deepEqual(skippedNotes(r), [
      "Read 2 of 4 lines",
      "Skipped: Feb 30 — 4:00 PM — Impossible date",
      "Skipped: Tue, Oct 27 — 25:00 — Bad time",
    ]);
  });

  test("skipped notes fit the ChangeSet's 10 assumptions", () => {
    const skipped = Array.from({ length: 15 }, (_, i) => `line ${i}`);
    const notes = skippedNotes({ tasks: [], total: 15, skipped });
    assert.ok(notes.length <= 10);
    assert.equal(notes[0], "Read 0 of 15 lines");
    assert.equal(notes.at(-1), "Skipped 7 more lines");
  });

  test("saved ops match the shown lines exactly (planOps)", () => {
    const r = parsePlanText(EM_DASH_REPLY, TODAY);
    const ops = dr.planOps("ICF prep", r.tasks);
    const adds = ops.filter((o) => o.op === "add_task") as Array<Extract<(typeof ops)[number], { op: "add_task" }>>;
    assert.deepEqual(
      adds.map((o) => [o.title, o.date, o.time]),
      r.tasks.map((t) => [t.title, t.date, t.time])
    );
    assert.equal(ops[0].op, "create_plan");
  });

  test("year wraps December to January", () => {
    assert.equal(parseDayLabel("Jan 3", "2026-12-28"), "2027-01-03");
    assert.equal(parseDayLabel("Dec 22", "2026-12-28"), "2026-12-22"); // under a week ago stays
    assert.equal(parseDayLabel("Tomorrow", "2026-12-31"), "2027-01-01");
  });

  test("time labels", () => {
    assert.equal(parseTimeLabel("4:00 PM"), "16:00");
    assert.equal(parseTimeLabel("4-5pm"), "16:00");
    assert.equal(parseTimeLabel("11-1pm"), "11:00");
    assert.equal(parseTimeLabel("16:00"), "16:00");
    assert.equal(parseTimeLabel("noon"), "12:00");
    assert.equal(parseTimeLabel("3"), null);
  });

  test("non-schedule lines are not counted", () => {
    assert.equal(countScheduleLines("Great question! Monday is a good day to start.\nMay I suggest a break?"), 0);
    assert.equal(countScheduleLines(EM_DASH_REPLY), 5);
  });

  test("stripModeSwitchLine removes only the switch line", () => {
    const out = stripModeSwitchLine(EM_DASH_REPLY);
    assert.ok(!/switch to calendar/i.test(out));
    assert.equal(countScheduleLines(out), 5);
  });

  test("isAddShownPlan", () => {
    for (const s of ["Add this plan to my calendar", "add this plan", "put it on my calendar", "add it", "yes, add them", "Save that schedule"]) {
      assert.equal(isAddShownPlan(s), true, s);
    }
    for (const s of ["add dentist tomorrow", "what's my plan?", "ideas for my ICF project"]) {
      assert.equal(isAddShownPlan(s), false, s);
    }
  });
});
