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

type Mod = typeof import("./human-dates");
void (import("./human-dates") as Promise<Mod>).then(({ humanizeDates }) => {
  test("ISO dates in a reply read like a person wrote them (overnight 2 L10)", () => {
    assert.equal(humanizeDates("Your first step is on Monday, 2026-11-23, at 3:30 PM."), "Your first step is on Monday, Nov 23, at 3:30 PM.");
    assert.equal(humanizeDates("due 2026-11-26"), "due Thursday, Nov 26");
    assert.equal(humanizeDates("Friday 2026-12-18 and 2026-12-17"), "Friday, Dec 18 and Thursday, Dec 17");
    assert.equal(humanizeDates("no dates here, 2026 was fine"), "no dates here, 2026 was fine");
    assert.equal(humanizeDates("bad 2026-02-30"), "bad 2026-02-30");
  });
});
