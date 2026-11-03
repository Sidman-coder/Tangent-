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

void (import("./task-filters") as Promise<typeof import("./task-filters")>).then(({ applyTaskFilter, endOfWeek, matchesDay, parseTaskFilter, timeOfDay }) => {
  const TUE = "2026-11-03";
  const t = (date: string, time: string, source?: string) => ({ date, time, source });
  const self = <T,>(x: T) => x;

  test("time of day boundaries follow the chips", () => {
    assert.equal(timeOfDay(t(TUE, "11:59")), "morning");
    assert.equal(timeOfDay(t(TUE, "12:00")), "afternoon");
    assert.equal(timeOfDay(t(TUE, "17:00")), "afternoon");
    assert.equal(timeOfDay(t(TUE, "17:01")), "evening");
    assert.equal(timeOfDay(t(TUE, "")), null);
  });

  test("a Canvas due date has no time to filter by", () => {
    assert.equal(timeOfDay(t(TUE, "23:59", "canvas")), null);
  });

  test("the week runs Monday to Sunday", () => {
    assert.equal(endOfWeek("2026-11-02"), "2026-11-08");
    assert.equal(endOfWeek(TUE), "2026-11-08");
    assert.equal(endOfWeek("2026-11-08"), "2026-11-08");
  });

  test("days: overdue stays on today and this week, not tomorrow", () => {
    assert.equal(matchesDay("2026-11-01", "today", TUE), true);
    assert.equal(matchesDay("2026-11-01", "week", TUE), true);
    assert.equal(matchesDay("2026-11-01", "tomorrow", TUE), false);
    assert.equal(matchesDay("2026-11-04", "tomorrow", TUE), true);
    assert.equal(matchesDay("2026-11-08", "week", TUE), true);
    assert.equal(matchesDay("2026-11-09", "week", TUE), false);
  });

  test("undated work only shows under All", () => {
    for (const day of ["today", "tomorrow", "week"] as const) assert.equal(matchesDay("", day, TUE), false);
    assert.equal(matchesDay("", "all", TUE), true);
  });

  test("day and time combine", () => {
    const list = [t(TUE, "09:00"), t(TUE, "18:00"), t("2026-11-04", "09:00")];
    assert.deepEqual(applyTaskFilter(list, self, { day: "today", time: "morning" }, TUE).main, [list[0]]);
    assert.deepEqual(applyTaskFilter(list, self, { day: "tomorrow", time: "evening" }, TUE).main, []);
    assert.deepEqual(applyTaskFilter(list, self, { day: "all", time: "any" }, TUE).main, list);
  });

  test("no-time tasks group apart, and only under Any", () => {
    const list = [t("", ""), t(TUE, ""), t(TUE, "09:00")];
    const any = applyTaskFilter(list, self, { day: "all", time: "any" }, TUE);
    assert.deepEqual(any.noTime, [list[0], list[1]]);
    assert.deepEqual(any.main, [list[2]]);
    assert.deepEqual(applyTaskFilter(list, self, { day: "all", time: "morning" }, TUE).noTime, []);
    assert.deepEqual(applyTaskFilter(list, self, { day: "today", time: "any" }, TUE).noTime, [list[1]]);
  });

  test("overdue work with no time keeps its place", () => {
    const list = [t("2026-11-01", "23:59", "canvas"), t(TUE, "09:00")];
    const any = applyTaskFilter(list, self, { day: "today", time: "any" }, TUE);
    assert.deepEqual(any.main, list);
    assert.deepEqual(any.noTime, []);
    assert.deepEqual(applyTaskFilter(list, self, { day: "today", time: "morning" }, TUE).main, [list[1]]);
  });

  test("a saved filter that doesn't read falls back", () => {
    const fallback = { day: "all", time: "any" } as const;
    assert.deepEqual(parseTaskFilter('{"day":"week","time":"evening"}', fallback), { day: "week", time: "evening" });
    assert.deepEqual(parseTaskFilter('{"day":"someday","time":"evening"}', fallback), fallback);
    assert.deepEqual(parseTaskFilter("not json", fallback), fallback);
    assert.deepEqual(parseTaskFilter(null, fallback), fallback);
  });
});
