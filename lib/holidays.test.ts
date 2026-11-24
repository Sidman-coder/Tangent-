// Run with `npm test`.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
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

type Mod = typeof import("./holidays");
void (import("./holidays") as Promise<Mod>).then(({ usSchoolHolidays, upcomingHolidays, holidayLine }) => {
  test("US school holidays land on the right days", () => {
    const h = new Map(usSchoolHolidays(2026).map((x) => [x.name, x.date]));
    assert.equal(h.get("Thanksgiving"), "2026-11-26");
    assert.equal(h.get("the day after Thanksgiving"), "2026-11-27");
    assert.equal(h.get("Labor Day"), "2026-09-07");
    assert.equal(h.get("Memorial Day"), "2026-05-25");
    assert.equal(h.get("Martin Luther King Jr. Day"), "2026-01-19");
  });

  test("the prompt hears about Thanksgiving the week before (overnight 2 L11)", () => {
    assert.deepEqual(upcomingHolidays("2026-11-22").map((x) => x.date), ["2026-11-26", "2026-11-27"]);
    assert.match(holidayLine("2026-11-22"), /2026-11-26 is Thanksgiving/);
    assert.equal(holidayLine("2026-10-10"), "");
    assert.deepEqual(upcomingHolidays("2026-12-28").map((x) => x.name), ["New Year's Day"]);
  });
});
