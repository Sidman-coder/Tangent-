// Run with `npm test`. Round 6 (item 2): deadlines and busy times are hard
// rules. Each sim case (2026-11-22, user-simulation-tests/simulation/results)
// is placed by the spacing brain with the constraints, then the sims' own bad
// placements go through the placement check. Both must end with 0 overlaps
// and 0 steps on or after the deadline.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./types";

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
const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
type Slot = { title: string; date: string; time: string };

void Promise.all([
  import("./plan-constraints") as Promise<typeof import("./plan-constraints")>,
  import("./placement-check") as Promise<typeof import("./placement-check")>,
  import("./load") as Promise<typeof import("./load")>,
  import("./time") as Promise<typeof import("./time")>,
  import("./ai/plan-guard") as Promise<typeof import("./ai/plan-guard")>,
]).then(([{ planConstraints }, { checkPlacement, dayItems }, { spreadSessions, DEFAULT_CAPACITY, DEFAULT_PLACEMENT_RULES }, { addDaysYMD, weekdayOf, daysBetweenYMD }, guard]) => {
  /** School Mon–Fri 8:00–3:00, as onboarding saves it. */
  function schoolWeeks(from: string, days: number): Task[] {
    const out: Task[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDaysYMD(from, i);
      const wd = weekdayOf(date);
      if (wd === 0 || wd === 6) continue;
      out.push({ id: `school-${date}`, title: "School", date, time: "08:00", completed: false, kind: "school", notes: "Until 3:00 PM" });
    }
    return out;
  }

  type Case = { name: string; text: string; today: string; endDate: string; tasks: Task[]; bad: Slot[] };

  /** Every violation, checked from the raw windows: a step in a typed busy time, in school, late, or on/after the deadline. */
  function violations(c: Case, steps: Slot[]): string[] {
    const cons = planConstraints(c.text, c.today);
    const out: string[] = [];
    for (const s of steps) {
      const start = hm(s.time);
      const end = start + 45;
      if (cons.deadline && s.date >= cons.deadline.date) out.push(`${s.title} on ${s.date} is not before ${cons.deadline.date}`);
      for (const w of cons.avoid) if (w.weekday === weekdayOf(s.date) && start < w.end && w.start < end) out.push(`${s.title} ${s.date} ${s.time} in a busy window`);
      if (c.tasks.some((t) => t.date === s.date && t.kind === "school") && start < H(15) && H(8) < end) out.push(`${s.title} in school`);
    }
    return out;
  }

  /** The pipeline's placement: the round ends the day before the deadline, and is spread around the typed windows. */
  function place(c: Case, count: number): Slot[] {
    const cons = planConstraints(c.text, c.today);
    const lastDate = cons.deadline ? addDaysYMD(cons.deadline.date, -1) : undefined;
    const end = lastDate && lastDate < c.endDate ? lastDate : c.endDate;
    const span = daysBetweenYMD(c.today, end);
    const dates = Array.from({ length: count }, (_, i) => addDaysYMD(c.today, 1 + Math.floor((i * (span - 1)) / Math.max(1, count - 1))));
    const rules = { ...DEFAULT_PLACEMENT_RULES, avoid: cons.avoid };
    return spreadSessions(c.tasks, dates, { now: { date: c.today, minutes: H(9) }, cap: DEFAULT_CAPACITY, rules, lastDate }).map((s, i) => ({
      title: `Step ${i + 1}`,
      date: s.date,
      time: s.time,
    }));
  }

  function check(c: Case, steps: Slot[]) {
    const cons = planConstraints(c.text, c.today);
    return checkPlacement(steps, {
      tasks: c.tasks,
      now: { date: c.today, minutes: H(9) },
      cap: DEFAULT_CAPACITY,
      rules: { ...DEFAULT_PLACEMENT_RULES, avoid: cons.avoid },
      deadline: cons.deadline,
    });
  }

  const priya: Case = {
    name: "Priya r2",
    text: "ED II supplemental essay #1 draft, need it ready before Jan 5. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm",
    today: "2026-11-23",
    endDate: "2026-11-29",
    tasks: schoolWeeks("2026-11-23", 14),
    // Priya r2 step 2: "Outline essay" Wed 6:30 PM (in her shift), and Sunday 2:00 PM (the minute it ends).
    bad: [
      { title: "Pick your supplement prompt", date: "2026-11-23", time: "16:30" },
      { title: "Outline essay", date: "2026-11-25", time: "18:30" },
      { title: "Draft the opening", date: "2026-11-28", time: "15:00" },
      { title: "Draft the body", date: "2026-11-29", time: "13:30" },
    ],
  };
  const leo: Case = {
    name: "Leo c9v/r2",
    text: "Algebra 2 test Friday on exponentials and logs, need to study but I'm also editing Sunday's video",
    today: "2026-11-23",
    endDate: "2026-11-29",
    tasks: schoolWeeks("2026-11-23", 7),
    // Leo c9v: log problems Sat Nov 28 and a "final check" quiz Sun Nov 29 11 AM, after the test.
    bad: [
      { title: "Learn exponent rules", date: "2026-11-23", time: "16:00" },
      { title: "Learn log rules and change of base", date: "2026-11-24", time: "16:00" },
      { title: "Solve log equations", date: "2026-11-28", time: "15:00" },
      { title: "Solve 6 mixed log and exponential problems", date: "2026-11-29", time: "11:00" },
    ],
  };
  const maya: Case = {
    name: "Maya j3a/r2",
    text: "the final is Thu Dec 17 not tomorrow. spread study sessions over the weeks before it, not tue 3:30-5 (debate) and nothing after 11pm",
    today: "2026-11-22",
    endDate: "2026-12-17",
    tasks: schoolWeeks("2026-11-22", 28),
    // Maya r2: Tue Nov 24 4:30 PM (debate); j3a: the only step on Thu Dec 17, the day of the final.
    bad: [
      { title: "Review equilibrium and Ksp", date: "2026-11-24", time: "16:30" },
      { title: "Timed FRQ set", date: "2026-12-08", time: "16:00" },
      { title: "Full practice exam", date: "2026-12-17", time: "16:30" },
    ],
  };

  for (const c of [priya, leo, maya]) {
    test(`${c.name}: the spacing brain places 0 steps in a block or after the deadline`, () => {
      const placed = place(c, 4);
      assert.equal(placed.length, 4);
      assert.deepEqual(violations(c, placed), []);
    });

    test(`${c.name}: the placement check fixes the sim's own placements (0 overlaps, 0 after the deadline)`, () => {
      assert.ok(violations(c, c.bad).length > 0, "the sim placement really was wrong");
      const r = check(c, c.bad);
      assert.deepEqual(violations(c, r.steps), []);
      assert.equal(r.steps.length + r.dropped.length, c.bad.length);
      // Order is kept: each step's slot is no earlier than the one before it.
      for (let i = 1; i < r.steps.length; i++) {
        assert.ok(`${r.steps[i].date} ${r.steps[i].time}` >= `${r.steps[i - 1].date} ${r.steps[i - 1].time}`);
      }
    });
  }

  test("Leo: both after-test steps move before Friday", () => {
    const r = check(leo, leo.bad);
    assert.equal(r.moved, 2);
    assert.equal(r.dropped.length, 0);
    assert.ok(r.steps.every((s) => s.date < "2026-11-27"));
  });

  test("Maya: the event itself may sit on Dec 17; prep may not", () => {
    const r = check(maya, [...maya.bad, { title: "AP Chem final", date: "2026-12-17", time: "08:00" }]);
    assert.ok(r.steps.some((s) => s.title === "AP Chem final" && s.date === "2026-12-17"));
    assert.ok(r.steps.filter((s) => s.title !== "AP Chem final").every((s) => s.date < "2026-12-17"));
  });

  test("no room before the deadline: the step is dropped with the shorten-the-plan question", () => {
    const r = checkPlacement(
      [
        { title: "Review logs", date: "2026-11-26", time: "16:00", minutes: 90 },
        { title: "Mixed problems", date: "2026-11-27", time: "16:00", minutes: 90 },
      ],
      {
        tasks: schoolWeeks("2026-11-26", 3),
        now: { date: "2026-11-26", minutes: H(9) },
        cap: { weekday: 100, weekend: 240 },
        deadline: { date: "2026-11-27", label: "your test" },
      }
    );
    assert.deepEqual(r.dropped.map((d) => d.title), ["Mixed problems"]);
    assert.deepEqual(r.notes, ["Couldn't fit \"Mixed problems\" before Nov 27; want me to shorten the plan?"]);
  });

  test("Because truth check: Priya's 'after your 4-9pm hours' at 6:30 PM Wednesday is rewritten from the real slot", () => {
    const cons = planConstraints(priya.text, priya.today);
    const why = "You asked to move the outline off Wednesday's shift, so it comes after your 4-9pm hours";
    const wed = { date: "2026-11-25", time: "18:30", blocks: dayItems(priya.tasks, "2026-11-25", cons.busy), deadline: cons.deadline };
    assert.ok(guard.claimCheck(why, wed));
    const moved = check(priya, priya.bad).steps.find((s) => s.title === "Outline essay")!;
    const facts = { date: moved.date, time: moved.time, blocks: dayItems(priya.tasks, moved.date, cons.busy), deadline: cons.deadline };
    const fixed = guard.truthfulReason(why, facts);
    assert.notEqual(fixed, why);
    assert.equal(guard.claimCheck(fixed, facts), null);
  });

  test("Because truth check: true claims stay, false ones are caught", () => {
    const blocks = [{ label: "soccer practice", start: H(15, 30), end: H(17, 30) }];
    const test = { date: "2026-11-27", label: "your test" };
    assert.equal(guard.claimCheck("Right after soccer practice, while you're still warm.", { date: "2026-11-24", time: "18:00", blocks }), null);
    assert.ok(guard.claimCheck("Right after soccer practice.", { date: "2026-11-24", time: "16:00", blocks }));
    assert.ok(guard.claimCheck("Saturday is after the test, a last check.", { date: "2026-11-26", time: "16:00", blocks: [], deadline: test }));
    assert.equal(guard.claimCheck("Two days before your test, so there's time to fix gaps.", { date: "2026-11-25", time: "16:00", blocks: [], deadline: test }), null);
    assert.ok(guard.claimCheck("Early evening, after dinner.", { date: "2026-11-29", time: "11:00", blocks: [] }));
    assert.equal(guard.placementReason({ date: "2026-11-24", time: "18:00", blocks }), "Starts after soccer practice ends (5:30 PM).");
    // Reasons from the 2026-11-22 targeted eval, after the check moved their steps.
    const shift = [{ label: "bakery shift", start: H(16), end: H(21) }];
    assert.ok(guard.claimCheck("Your bakery shift runs 4-9pm, so this 6:30 session sits in it.", { date: "2026-11-24", time: "16:00", blocks: [] }));
    assert.equal(guard.claimCheck("Your bakery shift runs 4-9pm, so this 6:30 session sits in it.", { date: "2026-11-25", time: "18:30", blocks: shift }), null);
    assert.ok(guard.claimCheck("Saturday is free, so this is the longest stretch.", { date: "2026-11-25", time: "16:00", blocks: [] }));
    assert.equal(guard.claimCheck("Saturday is free, so this is the longest stretch.", { date: "2026-11-28", time: "15:00", blocks: [] }), null);
    assert.equal(guard.claimCheck("It builds on Monday's exponent rules before Sunday's video edit.", { date: "2026-11-24", time: "16:00", blocks: [] }), null);
    assert.equal(guard.claimCheck("Your test on Friday covers logs.", { date: "2026-11-24", time: "16:00", blocks: [], deadline: test }), null);
    const final = { date: "2026-12-17", label: "your final" };
    assert.ok(guard.claimCheck("This is the afternoon of the final itself, so it's light.", { date: "2026-12-16", time: "16:00", blocks: [], deadline: final }));
    assert.ok(guard.claimCheck("The night before your final, a calm review.", { date: "2026-12-14", time: "16:00", blocks: [], deadline: final }));
    assert.equal(guard.claimCheck("The night before your final, a calm review.", { date: "2026-12-16", time: "19:00", blocks: [], deadline: final }), null);
    // Round 6 item 7 (targeted eval, Maya): moved Dec 17 → Dec 16, the reason still said "same day".
    const sameDay = "The final is this same day, so this is a last timed check of equilibrium and Ksp mixed with other units.";
    assert.ok(guard.claimCheck(sameDay, { date: "2026-12-16", time: "15:30", blocks: [], deadline: final }));
    assert.equal(guard.claimCheck(sameDay, { date: "2026-12-17", time: "07:00", blocks: [], deadline: final }), null);
    assert.ok(guard.claimCheck("Same day as your final, so keep it light.", { date: "2026-12-15", time: "16:00", blocks: [], deadline: final }));
    // The reruns' wordings for the same moved step.
    const named = "A final-style run through your weakest topics on 17 Dec gives one last check before the AP Chem final.";
    assert.equal(guard.finalReason(named, { date: "2026-12-16", time: "16:00", blocks: [] }, true), "Open time on Wednesday at 4:00 PM.");
    assert.equal(guard.finalReason("By Dec 8 the basics are set, so this builds on them.", { date: "2026-12-08", time: "16:00", blocks: [] }, true), "Open time on Tuesday at 4:00 PM.");
    assert.equal(guard.finalReason("Ksp is the other weak spot you named.", { date: "2026-12-08", time: "16:00", blocks: [] }, true), "Ksp is the other weak spot you named.");
    assert.equal(guard.finalReason("Mark 3 problems you missed and decide 2 to redo.", { date: "2026-12-08", time: "16:00", blocks: [] }, true), "Mark 3 problems you missed and decide 2 to redo.");
    const lands = "The final lands on this date, so this session is a last review of equilibrium and Ksp.";
    assert.ok(guard.claimCheck(lands, { date: "2026-12-16", time: "15:30", blocks: [], deadline: final }));
    assert.equal(guard.claimCheck(lands, { date: "2026-12-17", time: "07:00", blocks: [], deadline: final }), null);
    assert.equal(guard.claimCheck("The final is the day after, so keep it light.", { date: "2026-12-16", time: "15:30", blocks: [], deadline: final }), null);
    const finalsDate = "This session falls on the final's date, so it's a light timed mix of equilibrium and Ksp.";
    assert.ok(guard.claimCheck(finalsDate, { date: "2026-12-16", time: "15:30", blocks: [], deadline: final }));
    assert.equal(guard.claimCheck(finalsDate, { date: "2026-12-17", time: "07:00", blocks: [], deadline: final }), null);
    assert.equal(guard.finalReason("Light, since it's the same day as your quiz.", { date: "2026-12-16", time: "16:00", blocks: [] }, true), "Open time on Wednesday at 4:00 PM.");
    assert.ok(guard.claimCheck("Your final is tomorrow, so just a calm review.", { date: "2026-12-14", time: "16:00", blocks: [], deadline: final }));
    assert.equal(guard.claimCheck("Your final is tomorrow, so just a calm review.", { date: "2026-12-16", time: "16:00", blocks: [], deadline: final }), null);
    assert.equal(
      guard.finalReason(sameDay, { date: "2026-12-16", time: "15:30", blocks: [{ label: "school", start: H(8), end: H(15) }], deadline: final }, true),
      "Starts after school ends (3:00 PM)."
    );
    // A moved step's reason was written for the old slot: one that talks about a day, time or block is replaced.
    const tue = { date: "2026-11-24", time: "15:30", blocks: [{ label: "school", start: H(8), end: H(15) }] };
    const stale = "A concrete scene beats a list; this fits inside your Wed 4-9pm shift as a short pre-planning session.";
    assert.ok(guard.claimCheck(stale, tue));
    assert.equal(guard.finalReason(stale, tue, true), "Starts after school ends (3:00 PM).");
    const topical = "You said equilibrium and Ksp are your weakest areas, so this targets equilibrium first.";
    assert.equal(guard.finalReason(topical, tue, true), topical);
    assert.equal(
      guard.placementReason({ date: "2026-11-25", time: "19:30", blocks: [], deadline: test }),
      "Open time on Wednesday, 2 days before your test."
    );
  });
});
