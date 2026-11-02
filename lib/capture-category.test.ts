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


type Mod = typeof import("./capture-category");
void (import("./capture-category") as Promise<Mod>).then(({ categoryPatch }) => {
  test("academic files it on the School calendar without making it a School Block", () => {
    assert.deepEqual(categoryPatch("academic", {}), { calendarId: "cal_school" });
  });

  test("extracurricular and personal set the kind and the No school calendar", () => {
    assert.deepEqual(categoryPatch("extracurricular", {}), { kind: "academic-ec", calendarId: "cal_other" });
    assert.deepEqual(categoryPatch("personal", { kind: "personal" }), { kind: "personal", calendarId: "cal_other" });
  });

  test("never overrides Canvas, a kind someone chose, or an empty answer", () => {
    assert.equal(categoryPatch("personal", { source: "canvas" }), null);
    assert.equal(categoryPatch("academic", { kind: "side-ec" }), null);
    assert.equal(categoryPatch("academic", { kind: "commitment" }), null);
    assert.equal(categoryPatch("", {}), null);
  });
});
