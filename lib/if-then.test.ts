// Run with `npm test`. Round 6 (item 4): each step's if-then line, cued by a
// real item that ends just before the step, else by the step's own time.
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

const H = (h: number, m = 0) => h * 60 + m;

void Promise.all([
  import("./if-then") as Promise<typeof import("./if-then")>,
  import("./note-parts") as Promise<typeof import("./note-parts")>,
  import("./plan-steps-view") as Promise<typeof import("./plan-steps-view")>,
]).then(([{ ifThenLine, parseIfThen, ifThenFits, ifThenFor, shortTitle, cueFor }, { noteParts, whenPart }, { stepCards }]) => {
  const soccer = { label: "Soccer practice", start: H(15, 30), end: H(17, 30) };
  const school = { label: "School", start: H(8), end: H(15) };

  test("a fixed item ending just before the step is the cue", () => {
    assert.equal(
      ifThenLine({ title: "Wire the motor", date: "2026-11-24", time: "17:45", minutes: 30 }, [school, soccer]),
      "When soccer practice ends Tuesday (5:30 PM), then 30 min: wire the motor."
    );
    assert.equal(
      ifThenLine({ title: "Outline the essay", date: "2026-11-23", time: "15:15" }, [school]),
      "When school ends Monday (3:00 PM), then outline the essay."
    );
    // A typed busy window counts too (Priya's Sunday shift, 8 AM–2 PM).
    assert.equal(
      ifThenLine({ title: "Revise the draft", date: "2026-11-29", time: "14:30", minutes: 45 }, [{ label: "bakery shift", start: H(8), end: H(14) }]),
      "When bakery shift ends Sunday (2:00 PM), then 45 min: revise the draft."
    );
    assert.equal(
      ifThenLine({ title: "Revise the draft", date: "2026-11-29", time: "14:30" }, [{ label: "bakery shifts", start: H(8), end: H(14) }]),
      "When bakery shifts end Sunday (2:00 PM), then revise the draft."
    );
    assert.deepEqual(parseIfThen("When bakery shifts end Sunday (2:00 PM), then revise the draft."), { kind: "when", label: "bakery shifts", day: "Sunday", end: H(14) });
  });

  test("no cue within 30 minutes: the step's own time", () => {
    assert.equal(
      ifThenLine({ title: "Wire the motor", date: "2026-11-24", time: "19:30", minutes: 45 }, [school, soccer]),
      "At 7:30 PM Tuesday, then 45 min: wire the motor."
    );
    assert.equal(cueFor({ title: "x", date: "2026-11-24", time: "16:00" }, [school, soccer]), null);
    assert.equal(ifThenLine({ title: "Read SAT passage", date: "2026-11-28", time: "10:00" }, []), "At 10:00 AM Saturday, then read SAT passage.");
    assert.equal(ifThenLine({ title: "Untimed", date: "2026-11-28", time: null }, []), "");
    // Caps that mean something stay ("AP Chem", "SAT").
    assert.match(ifThenLine({ title: "AP Chem practice set", date: "2026-12-16", time: "15:30" }, []), /then AP Chem practice set\.$/);
  });

  test("the cue reads back, and a moved step falls back to the time it's at now", () => {
    const line = "When soccer practice ends Tuesday (5:30 PM), then 30 min: wire the motor.";
    assert.deepEqual(parseIfThen(line), { kind: "when", label: "soccer practice", day: "Tuesday", end: H(17, 30) });
    assert.deepEqual(parseIfThen("At 7:30 PM Tuesday, then 45 min: wire the motor."), { kind: "at", day: "Tuesday", time: H(19, 30) });
    assert.equal(parseIfThen("Wire the motor"), null);
    assert.ok(ifThenFits(line, { title: "Wire the motor", date: "2026-11-24", time: "17:45" }));
    assert.ok(!ifThenFits(line, { title: "Wire the motor", date: "2026-11-25", time: "17:45" }));
    assert.ok(!ifThenFits(line, { title: "Wire the motor", date: "2026-11-24", time: "19:00" }));
    assert.equal(ifThenFor(line, { title: "Wire the motor", date: "2026-11-24", time: "17:45" }), line);
    assert.equal(ifThenFor(line, { title: "Wire the motor", date: "2026-11-26", time: "16:00" }), "At 4:00 PM Thursday, then wire the motor.");
  });

  test("titles stay 2 to 6 words, never cut mid-phrase", () => {
    assert.equal(shortTitle("Solve log equations"), "Solve log equations");
    assert.equal(shortTitle("Outline the essay around your strongest story"), "Outline essay around your strongest story");
    // Round 6 item 7 (targeted eval, Maya): a 7-word title with no trailing clause loses its article.
    assert.equal(shortTitle("Complete a full AP Chem practice final"), "Complete full AP Chem practice final");
    assert.equal(shortTitle("Work equilibrium and Q vs K problems"), "Work equilibrium and Q vs K problems");
    assert.equal(shortTitle("Redo missed problems, then check every answer"), "Redo missed problems");
    assert.equal(shortTitle("Review exponent rules and formulas for the Friday test"), "Review exponent rules and formulas");
    assert.equal(shortTitle("Take a timed mixed AP Chem practice set"), "Take a timed mixed AP Chem practice set");
  });

  test("the WHEN: line rides in the notes, shows under the title, never as a part", () => {
    const notes = "WHEN: At 4:30 PM Monday, then 45 min: brainstorm angles.\nWHY: Monday is clear after school.\nBECAUSE: Mon, Nov 23 is free on your calendar";
    assert.equal(whenPart(notes), "At 4:30 PM Monday, then 45 min: brainstorm angles.");
    assert.deepEqual(noteParts(notes)?.map((p) => p.label), ["Why", "Because"]);
    assert.equal(noteParts("WHEN: At 4:30 PM Monday, then brainstorm.", true), null);
    const [card] = stepCards([{ op: "add_task", title: "Brainstorm angles", date: "2026-11-23", time: "16:30", notes }]);
    assert.equal(card.ifThen, "At 4:30 PM Monday, then 45 min: brainstorm angles.");
    assert.equal(card.why, "Monday is clear after school.");
    // Moved in the draft's edit mode: the card says where it is now.
    const [moved] = stepCards([{ op: "add_task", title: "Brainstorm angles", date: "2026-11-24", time: "18:00", notes }]);
    assert.equal(moved.ifThen, "At 6:00 PM Tuesday, then brainstorm angles.");
  });
});
