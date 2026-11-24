// Run with `npm test`. Overnight 2 (Jordan sim): a report on a step typed into
// Home is logged on that step, never turned into new work.
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

void (import("./progress-report") as Promise<typeof import("./progress-report")>).then(({ isProgressReport, reportFeel, reportedStep }) => {
  const jordan = "Drafted the club pitch, went fine, took about 20 min, kept it to one page";

  test("isProgressReport: how it went, not a plan", () => {
    assert.equal(isProgressReport(jordan), true);
    assert.equal(isProgressReport("finished the lab report, took me an hour"), true);
    assert.equal(isProgressReport("chem quiz went badly"), true);
    assert.equal(isProgressReport("I need to draft the club pitch by Friday"), false);
    assert.equal(isProgressReport("Start Environmental Club - need a faculty sponsor"), false);
    assert.equal(isProgressReport("this will take about 20 min tomorrow"), false);
  });

  test("reportFeel: a code only when the words say one", () => {
    assert.equal(reportFeel(jordan), "okay");
    assert.equal(reportFeel("nailed it"), "nailed");
    assert.equal(reportFeel("the quiz went badly"), "struggled");
    assert.equal(reportFeel("took 20 min"), null);
  });

  test("reportedStep: the recent step it names, done ones first", () => {
    const today = "2026-11-23";
    const tasks = [
      { id: "a", title: "Draft club pitch and shortlist sponsors", date: "2026-11-23", completed: true },
      { id: "b", title: "Email two teachers about sponsoring the club", date: "2026-11-25", completed: false },
      { id: "c", title: "Codeforces Div 3 problem A", date: "2026-11-23", completed: false },
      { id: "d", title: "Draft club pitch (old)", date: "2026-11-10", completed: false },
    ];
    assert.equal(reportedStep(tasks, jordan, today)?.id, "a");
    assert.equal(reportedStep(tasks, "went fine", today), null);
    assert.equal(reportedStep(tasks, "the essay went badly", today), null);
  });
});
