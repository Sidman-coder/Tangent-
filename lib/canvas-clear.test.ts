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


type Mod = typeof import("./canvas-clear");
void (import("./canvas-clear") as Promise<Mod>).then(({ isCanvasCleared, withoutClearedCanvas }) => {
  const canvas = (date: string, completed = false) => ({ source: "canvas" as const, completed, date });

  test("a Canvas item due 2 days ago is cleared, one due yesterday is not", () => {
    assert.equal(isCanvasCleared(canvas("2026-10-20"), "2026-10-22"), true);
    assert.equal(isCanvasCleared(canvas("2026-10-21"), "2026-10-22"), false);
    assert.equal(isCanvasCleared(canvas("2026-10-01"), "2026-10-22"), true);
  });

  test("completed Canvas items and non-Canvas tasks are never cleared", () => {
    assert.equal(isCanvasCleared(canvas("2026-10-01", true), "2026-10-22"), false);
    assert.equal(isCanvasCleared({ source: undefined, completed: false, date: "2026-10-01" }, "2026-10-22"), false);
  });

  test("clearing counts days across a month boundary", () => {
    assert.equal(isCanvasCleared(canvas("2026-10-30"), "2026-11-01"), true);
    assert.equal(isCanvasCleared(canvas("2026-10-31"), "2026-11-01"), false);
  });

  test("withoutClearedCanvas keeps order and drops only cleared items", () => {
    const a = { id: "a", source: undefined, completed: false, date: "2026-10-01" };
    const b = { id: "b", ...canvas("2026-10-01") };
    const c = { id: "c", ...canvas("2026-10-22") };
    assert.deepEqual(withoutClearedCanvas([a, b, c], "2026-10-22").map((t) => t.id), ["a", "c"]);
  });
});
