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


type Mod = typeof import("./focus-timer");
void (import("./focus-timer") as Promise<Mod>).then(({ startFocus, extendFocus, remainingMs, parseFocus, firstStep, FOCUS_MINUTES, EXTEND_MINUTES }) => {
  test("a focus session runs 25 minutes from the start", () => {
    assert.equal(FOCUS_MINUTES, 25);
    assert.deepEqual(startFocus("t", 1000), { taskId: "t", endsAt: 1000 + 25 * 60_000 });
  });

  test("remaining time counts down and never goes below zero", () => {
    const s = startFocus("t", 0);
    assert.equal(remainingMs(s, 60_000), 24 * 60_000);
    assert.equal(remainingMs(s, 99 * 60_000), 0);
  });

  test("10 more minutes runs from now once time is up", () => {
    assert.equal(EXTEND_MINUTES, 10);
    const s = startFocus("t", 0);
    assert.equal(extendFocus(s, 30 * 60_000).endsAt, 40 * 60_000);
  });

  test("a saved session survives a reload; junk does not", () => {
    assert.equal(parseFocus(null), null);
    assert.equal(parseFocus("nope"), null);
    assert.equal(parseFocus(JSON.stringify({ taskId: 3, endsAt: "x" })), null);
    assert.deepEqual(parseFocus(JSON.stringify({ taskId: "t", endsAt: 5 })), { taskId: "t", endsAt: 5 });
  });

  test("the first step falls back when the task has none", () => {
    assert.equal(firstStep({ startAction: "Open the lab doc" }), "Open the lab doc");
    assert.equal(firstStep({}), "Open it and do the first 5 minutes.");
    assert.equal(firstStep({ startAction: "   " }), "Open it and do the first 5 minutes.");
  });
});
