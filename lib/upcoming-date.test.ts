// Run with `npm test`. Same resolve hook as router-quick.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../${specifier.slice(2)}`, import.meta.url).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

type Mod = typeof import("./upcoming-date");
void (import("./upcoming-date") as Promise<Mod>).then(({ findMonthDates, upcomingRange, upcomingYmd }) => {
  // Overnight 2 eval ap-bio-plan: "AP Bio exam in May" on 22 Nov 2026 was
  // read as May 2026, a past date, and the plan got one session.
  test("a month and day with no year is the next one on or after today", () => {
    assert.equal(upcomingYmd("2026-11-22", 4, 1), "2027-05-01");
    assert.equal(upcomingYmd("2026-11-22", 11, 5), "2026-12-05");
    assert.equal(upcomingYmd("2026-11-22", 10, 22), "2026-11-22");
  });

  test("findMonthDates reads short and full month names with their day (Maya sim)", () => {
    const days = (t: string) => findMonthDates(t).map((d) => [d.month, d.day]);
    assert.deepEqual(days("the final is Thu Dec 17 not tomorrow"), [[11, 17]]);
    assert.deepEqual(days("from july 20 to july 27"), [[6, 20], [6, 27]]);
    assert.deepEqual(days("AP Bio exam in May"), [[4, 1]]);
    assert.deepEqual(days("17th of december"), [[11, 17]]);
    assert.deepEqual(days("Sept. 3 to Oct 1st"), [[8, 3], [9, 1]]);
    assert.deepEqual(days("the twentieth of march"), [[2, 20]]);
    // Words that only look like months.
    assert.deepEqual(days("I may need grammar help, marching band and a summary"), []);
  });

  test("a range that crosses New Year ends in the next year", () => {
    assert.deepEqual(upcomingRange("2026-11-22", { month: 11, day: 28 }, { month: 0, day: 4 }), { start: "2026-12-28", end: "2027-01-04" });
    assert.deepEqual(upcomingRange("2026-11-22", { month: 0, day: 10 }, { month: 0, day: 20 }), { start: "2027-01-10", end: "2027-01-20" });
  });
});
