// Run with `npm test`. Round 4 §3.4: plans come in rounds. Same resolve hook
// as project-stats.test.ts.
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

void (import("./rounds") as Promise<typeof import("./rounds")>).then(
  ({ roundStepCount, roundDates, withOutcome, outcomeFromNotes, notesWithoutOutcome, roundOf, withRound, roundChip, reviewDue, roundSummary, roundSteps, checkInsFromCodes }) => {
test("roundStepCount: 3 to 7 steps, fewer for long steps, never more than days", () => {
  assert.equal(roundStepCount(7), 5);
  assert.equal(roundStepCount(7, 20), 7);
  assert.equal(roundStepCount(7, 90), 3);
  assert.equal(roundStepCount(30), 5, "a long goal still gets one week's round");
  assert.equal(roundStepCount(2), 2, "a 2-day goal can't hold 3 steps on separate days");
  assert.equal(roundStepCount(1), 1);
});

test("roundDates: about a week from the start, never past the goal's end", () => {
  const d = roundDates("2026-11-08", "2026-12-31");
  assert.equal(d.length, 5);
  assert.equal(d[0], "2026-11-08");
  assert.equal(d[d.length - 1], "2026-11-14");
  const short = roundDates("2026-11-08", "2026-11-10");
  assert.deepEqual(short, ["2026-11-08", "2026-11-09", "2026-11-10"]);
  assert.deepEqual(roundDates("2026-11-08", "2026-11-01"), ["2026-11-08"]);
  assert.equal(new Set(d).size, d.length);
});

test("You'll have: kept as one notes line, replaced not duplicated", () => {
  const n = withOutcome("Draft three hooks.\nTIME: 30 min", "You'll have: a list of 10 post ideas.");
  assert.equal(n, "Draft three hooks.\nTIME: 30 min\nYOU'LL HAVE: a list of 10 post ideas");
  assert.equal(outcomeFromNotes(n), "a list of 10 post ideas");
  assert.equal(notesWithoutOutcome(n), "Draft three hooks.\nTIME: 30 min");
  const again = withOutcome(n, "a first draft");
  assert.equal(again?.match(/YOU'LL HAVE/g)?.length, 1);
  assert.equal(withOutcome("", ""), undefined);
  assert.equal(outcomeFromNotes("no outcome here"), null);
});

test("round line: parsed, replaced, and shown as a chip", () => {
  const desc = "Grow my channel\nBrief — Hours: 3 a week";
  const one = withRound(desc, { n: 1, startedOn: "2026-11-08" });
  assert.deepEqual(roundOf(one), { n: 1, startedOn: "2026-11-08" });
  const two = withRound(one, { n: 2, startedOn: "2026-11-15" });
  assert.deepEqual(roundOf(two), { n: 2, startedOn: "2026-11-15" });
  assert.equal(two.match(/^Round/gm)?.length, 1);
  assert.ok(two.startsWith("Grow my channel\nBrief"));
  assert.equal(roundOf("Grow my channel"), null);
  assert.equal(roundChip({ n: 1, startedOn: "2026-11-08" }), "Round 1 · started Nov 8");
});

test("reviewDue: at 70% done or after the round's last step day", () => {
  const r = { n: 1, startedOn: "2026-11-08" };
  const steps = (done: number, total = 5) =>
    Array.from({ length: total }, (_, i) => ({ date: `2026-11-${String(8 + i).padStart(2, "0")}`, completed: i < done }));
  assert.equal(reviewDue(steps(3), r, "2026-11-10"), false);
  assert.equal(reviewDue(steps(4), r, "2026-11-10"), true);
  assert.equal(reviewDue(steps(1), r, "2026-11-13"), true, "the round's last day has passed");
  assert.equal(reviewDue([], r, "2026-11-20"), false);
  assert.equal(reviewDue(steps(5), null, "2026-11-20"), false, "projects before rounds get no card");
  const older = [{ date: "2026-11-01", completed: false }, ...steps(0)];
  assert.equal(roundSteps(older, r).length, 5);
});

test("roundSummary: plain sentences from codes only", () => {
  const s = roundSummary(4, 5, [
    { feel: "struggled", time: "more" },
    { feel: "struggled", time: "more" },
    { feel: "okay", time: "about" },
  ], { no_time: 2, unclear: 1 });
  assert.ok(s.startsWith("You finished 4 of 5 steps."));
  assert.ok(s.includes("round 2 goes smaller"));
  assert.ok(s.includes("took longer"));
  assert.ok(s.includes("for no time"));
  assert.equal(roundSummary(1, 1, []), "You finished 1 of 1 step.");
  assert.ok(roundSummary(2, 3, [{ feel: "nailed", time: null }, { feel: "nailed", time: null }], {}, 3).includes("round 3 can stretch"));
});

test("checkInsFromCodes: one check-in per step, Not today reasons counted", () => {
  const { checkIns, notToday } = checkInsFromCodes([
    { taskId: "a", kind: "check_in", code: "struggled" },
    { taskId: "a", kind: "check_in", code: "longer" },
    { taskId: "b", kind: "check_in", code: "faster" },
    { taskId: "c", kind: "not_today", code: "no_time" },
    { taskId: "d", kind: "not_today", code: "no_time" },
  ]);
  assert.deepEqual(checkIns, [{ feel: "struggled", time: "more" }, { feel: null, time: "less" }]);
  assert.deepEqual(notToday, { no_time: 2 });
});
  },
);
