// Run with `npm test`. Overnight 2 (Maya sim): times the student said to keep
// free are read from the request and never get a session.
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
  import("./avoid-times") as Promise<typeof import("./avoid-times")>,
  import("./schedule-slots") as Promise<typeof import("./schedule-slots")>,
]).then(([{ avoidWindows, avoidOn }, { firstOpenTime }]) => {
  test("avoidWindows: Maya's request keeps Tuesday 3:30-5 free", () => {
    const w = avoidWindows("the final is Thu Dec 17 not tomorrow. spread study sessions over the weeks before it, not tue 3:30-5 (debate) and nothing after 11pm");
    assert.deepEqual(w, [{ weekday: 2, start: 15 * 60 + 30, end: 17 * 60 }]);
  });

  test("avoidWindows: other wordings, and a time to use is not a time to avoid", () => {
    assert.deepEqual(avoidWindows("no sessions Thursdays 4 to 6pm please"), [{ weekday: 4, start: 16 * 60, end: 18 * 60 }]);
    assert.deepEqual(avoidWindows("I'm busy Monday 15:30-17:30"), [{ weekday: 1, start: 15 * 60 + 30, end: 17 * 60 + 30 }]);
    assert.deepEqual(avoidWindows("can't do wednesdays 3-4:30 because of practice"), [{ weekday: 3, start: 15 * 60, end: 16 * 60 + 30 }]);
    assert.deepEqual(avoidWindows("study tue 3:30-5"), []);
    assert.deepEqual(avoidWindows("plan my chem final"), []);
  });

  test("firstOpenTime: never lands in a kept-free window", () => {
    const tue = "2026-11-24";
    assert.equal(firstOpenTime([], tue), "15:30");
    const avoid = avoidWindows("not tue 3:30-5 (debate)");
    assert.deepEqual(avoidOn(avoid, 2), [[930, 1020]]);
    assert.equal(firstOpenTime([], tue, 0, 45, { avoid }), "17:00");
    // Another day is untouched.
    assert.equal(firstOpenTime([], "2026-11-25", 0, 45, { avoid }), "15:30");
  });
});
