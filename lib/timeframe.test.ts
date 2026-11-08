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

void Promise.all([
  import("./timeframe") as Promise<typeof import("./timeframe")>,
  import("./ai/plan-brief") as Promise<typeof import("./ai/plan-brief")>,
]).then(([{ answeredEndDate, withoutFrequencies, TIMEFRAME_OPTIONS }, { briefAssumptions, briefQuestions, readBrief, saysWhen }]) => {
  const said = (answer: string, question = "By when?") => `help me learn guitar\n\nMy answers to your questions:\n- ${question} ${answer}`;
  const TUE = "2026-11-03";

  test("each chip means a real end date", () => {
    assert.equal(answeredEndDate(said("This week"), TUE), "2026-11-08");
    assert.equal(answeredEndDate(said("2 weeks"), TUE), "2026-11-16");
    assert.equal(answeredEndDate(said("1 month"), TUE), "2026-12-02");
    assert.equal(answeredEndDate(said("2026-12-06", "When is the exam?"), TUE), "2026-12-06");
    assert.equal(answeredEndDate(said("1 month", "When is the deadline or event?"), TUE), "2026-12-02");
  });

  test("this week near the weekend still leaves room to plan", () => {
    assert.equal(answeredEndDate(said("This week"), "2026-11-07"), "2026-11-09"); // Saturday
    assert.equal(answeredEndDate(said("This week"), "2026-11-08"), "2026-11-10"); // Sunday
  });

  test("no answer, a typed answer or a past date is not a range", () => {
    assert.equal(answeredEndDate("help me learn guitar", TUE), null);
    assert.equal(answeredEndDate(said("whenever summer starts"), TUE), null);
    assert.equal(answeredEndDate(said("2026-10-01"), TUE), null);
  });

  test("a frequency doesn't count as a duration", () => {
    const plain = (t: string) => withoutFrequencies(t).toLowerCase();
    assert.doesNotMatch(plain("practice 3 times a week"), /\ba week\b/);
    assert.doesNotMatch(plain("about 4 hours per week"), /\bper week\b/);
    assert.doesNotMatch(plain("once a week"), /\ba week\b/);
    assert.doesNotMatch(plain("x\n- How many times a week can you practice? 3 times"), /\ba week\b/);
    assert.match(plain("a plan for 2 weeks"), /2 weeks/);
    assert.match(plain("finish in a week"), /in a week/);
  });

  test("a plan with no timeframe asks once, with the chips, in the first questions", () => {
    for (const [request, id] of [
      ["help me study for the SAT", "brief-date"],
      ["help me get ready for ISEF", "brief-deadline"],
      ["I want to get better at chess", "brief-timeframe"],
    ]) {
      const asked = briefQuestions(readBrief(request)!);
      assert.equal(asked[0].id, id);
      assert.deepEqual(asked[0].options, TIMEFRAME_OPTIONS);
      assert.equal(asked.filter((q) => q.options === TIMEFRAME_OPTIONS || q.options.includes("Pick a date")).length, 1);
    }
  });

  test("a stated or known timeframe is never asked", () => {
    assert.ok(saysWhen("get better at chess in 2 weeks"));
    assert.ok(saysWhen("study for the SAT by Dec 6"));
    assert.equal(saysWhen("get better at chess"), false);
    const ids = (t: string, c?: string) => briefQuestions(readBrief(t, { studentContext: c })!).map((q) => q.id);
    assert.ok(!ids("get better at chess in 2 weeks").includes("brief-timeframe"));
    assert.ok(!ids("help me study for the SAT", "SAT: 2026-12-06").includes("brief-date"));
  });

  test("the question budget is three, whatever the kind of goal", () => {
    for (const t of ["help me study for the SAT", "help me get ready for ISEF", "I want to get better at chess"]) {
      assert.ok(briefQuestions(readBrief(t)!).length <= 3, t);
    }
  });

  test("Assumed about a week is gone from a brief's defaults", () => {
    for (const t of ["help me study for the SAT", "I want to get better at chess"]) {
      assert.ok(!briefAssumptions(readBrief(t)!).some((a) => /about a week|first month/i.test(a)), t);
    }
  });
});
