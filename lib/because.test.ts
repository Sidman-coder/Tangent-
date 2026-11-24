// Run with `npm test`. Overnight 2, Phase 3: every plan step's reason shows the
// fact it used, in the student's terms ("you said you focus best at night",
// "Soccer ends at 5:30 PM on Tue, Nov 17"), and it reaches the step's notes.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

void Promise.all([
  import("./because") as Promise<typeof import("./because")>,
  import("./note-parts") as Promise<typeof import("./note-parts")>,
  import("./plan-steps-view") as Promise<typeof import("./plan-steps-view")>,
]).then(([{ becauseLine, saidLine, calendarLine }, { noteParts }, { stepCards }]) => {
  const facts = [
    { id: "f1", text: "You focus best at night." },
    { id: "f2", text: "I'm on the soccer team" },
    { id: "f3", text: "Robotics Tue and Thu" },
  ];
  const week = [
    { title: "Soccer practice", date: "2026-11-24", time: "16:00", notes: "TIME: 90 mins" },
    { title: "Read ch. 4", date: "2026-11-24", time: "19:00" },
    { title: "Essay due", date: "2026-11-30", time: "23:59" },
  ];

  test("a fact pointer shows the fact, turned to the student's side", () => {
    assert.equal(becauseLine({ kind: "fact", ref: "f1" }, facts, week), "you said you focus best at night");
    assert.equal(becauseLine({ kind: "fact", ref: "f2" }, facts, week), "you said you're on the soccer team");
    assert.equal(becauseLine({ kind: "fact", ref: "f3" }, facts, week), "you said “Robotics Tue and Thu”");
    assert.equal(becauseLine({ kind: "fact", ref: "f9" }, facts, week), "", "an unknown id shows nothing");
    assert.equal(saidLine("My mornings are packed"), "you said your mornings are packed");
    // A round-review answer says the answer, not the stored record (overnight 2, 3.4 live).
    assert.equal(
      saidLine('Python Basics round 1, asked "Should next round include more practice problems, or fewer": More practice'),
      "you said “More practice” in your Python Basics round 1 review"
    );
  });

  test("a calendar pointer names what is on that day, with its end time", () => {
    assert.equal(becauseLine({ kind: "calendar", ref: "2026-11-24" }, facts, week), "Soccer practice ends at 5:30 PM on Tue, Nov 24, plus 1 more");
    assert.equal(calendarLine("2026-11-25", week), "Wed, Nov 25 is free on your calendar");
    assert.equal(calendarLine("2026-11-30", week), "Essay due is due on Mon, Nov 30");
    assert.equal(becauseLine({ kind: "calendar", ref: "next week" }, facts, week), "");
  });

  test("a holiday is named instead of the class block on it (overnight 2 R2-L2)", () => {
    const thanks = [{ title: "School", date: "2026-11-26", time: "08:00", notes: "TIME: 420 mins" }];
    assert.equal(calendarLine("2026-11-26", thanks), "Thu, Nov 26 is Thanksgiving, so most schools are closed");
  });

  test("a fixed item explains the day, not an early to-do (overnight 2, AI-JUDGMENT-1 #5)", () => {
    const wed = [
      { title: "Find club rules", date: "2026-11-25", time: "07:20" },
      { title: "School", date: "2026-11-25", time: "08:00", notes: "TIME: 420 mins", kind: "school" },
      { title: "Robotics", date: "2026-11-25", time: "15:30", notes: "TIME: 90 mins", kind: "commitment" },
    ];
    assert.equal(calendarLine("2026-11-25", wed), "Robotics ends at 5:00 PM on Wed, Nov 25, plus 2 more");
  });

  test("a topic pointer quotes what they asked about; no pointer shows nothing", () => {
    assert.equal(becauseLine({ kind: "topic", ref: "USACO silver" }, facts, week), "you asked about “USACO silver”");
    assert.equal(becauseLine(null, facts, week), "");
  });

  test("the BECAUSE: line reaches the step card and the task's note parts", () => {
    const notes = "Do two problems.\nWHY: Nights are when you focus, so this sits at 8 PM.\nBECAUSE: you said you focus best at night";
    const parts = noteParts(notes, true)!;
    assert.deepEqual(parts.map((p) => p.label), ["What to do", "Why", "Because"]);
    assert.equal(parts[2].text, "you said you focus best at night");
    const [card] = stepCards([{ op: "add_task", title: "Two problems", date: "2026-11-24", time: "20:00", notes }]);
    assert.equal(card.because, "you said you focus best at night");
    const [fallback] = stepCards([{ op: "add_task", title: "Two problems", date: "2026-11-24" }], [
      { what: "Two problems", when: "Tue", why: "x", youllHave: "y", because: "you said you focus best at night" },
    ]);
    assert.equal(fallback.because, "you said you focus best at night");
  });
});
