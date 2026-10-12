// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
import * as nodeModule from "node:module";
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

type Greetings = typeof import("./greetings");
void (import("./greetings") as Promise<Greetings>).then(({ getGreeting }) => {

test("never praises a day that still needs attention", () => {
  for (let seed = 0; seed < 6; seed++) {
    const g = getGreeting("Juann", 19, { left: 1, urgent: 1, done: 3 }, seed);
    assert.ok(!/nice work|all done|clear/i.test(g), g);
  }
});

test("praises a finished day", () => {
  assert.match(getGreeting("Juann", 19, { left: 0, urgent: 0, done: 2 }, 0), /Nice work today, Juann\./);
});

test("same greeting all day for the same seed", () => {
  assert.equal(getGreeting("Juann", 9, { left: 2, urgent: 0, done: 0 }, 11), getGreeting("Juann", 10, { left: 2, urgent: 0, done: 0 }, 11));
});

});
