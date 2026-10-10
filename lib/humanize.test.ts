// Run with `npm test`.
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

void (import("./humanize") as Promise<typeof import("./humanize")>).then(({ humanizeTimestamps }) => {
  test("raw timestamps read like a person wrote them", () => {
    assert.equal(humanizeTimestamps("Due 2026-10-08 23:59"), "Due Thu, Oct 8 · 11:59 PM");
    assert.equal(humanizeTimestamps("Meeting 2026-10-07 at 15:30."), "Meeting Wed, Oct 7 · 3:30 PM.");
    assert.equal(humanizeTimestamps("Free slot tomorrow at 14:00"), "Free slot tomorrow at 2:00 PM");
    assert.equal(humanizeTimestamps("at 3:00 PM already"), "at 3:00 PM already");
    assert.equal(humanizeTimestamps("Overdue: 2026-10-02 School"), "Overdue: Fri, Oct 2 School");
  });
});
