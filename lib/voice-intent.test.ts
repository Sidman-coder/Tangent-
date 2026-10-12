// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
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

type V = typeof import("./voice-intent");
void (import("./voice-intent") as Promise<V>).then(({ heardSomethingToAdd }) => {

test("a stray word or filler is not a task", () => {
  for (const t of ["wow", "Wow.", "um", "okay okay", "uh hi", "Thank you.", "testing", "Hmm, wow!"]) {
    assert.equal(heardSomethingToAdd(t), false, t);
  }
});

test("real asks go straight through", () => {
  for (const t of ["buy poster board tomorrow", "chem homework", "Email Ms. Lee about the field trip", "um study for the SAT"]) {
    assert.equal(heardSomethingToAdd(t), true, t);
  }
});

});
