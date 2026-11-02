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

type D = typeof import("./notification-dedupe");
void (import("./notification-dedupe") as Promise<D>).then(({ collapseDuplicates }) => {

const n = (title: string, minute: number, type = "reminder") => ({ title, type, timestamp: `2026-10-11T21:${String(minute).padStart(2, "0")}:00Z` });

test("the same reminder shows once, newest kept", () => {
  const out = collapseDuplicates([
    n("Envelope Quotes due tomorrow", 10),
    n("Envelope Quotes due tomorrow", 30),
    n("Two deadlines on Tuesday", 20),
    n("Multiple deadlines Tuesday", 25),
    n("Two deadlines Tuesday", 5),
    n("Prep time for speaking assessment", 1),
  ]);
  assert.deepEqual(out.map((x) => `${x.title}@${x.timestamp.slice(14, 16)}`), [
    "Envelope Quotes due tomorrow@30",
    "Multiple deadlines Tuesday@25",
    "Prep time for speaking assessment@01",
  ]);
});

test("different reminders and daily briefs are kept", () => {
  const out = collapseDuplicates([n("Envelope Quotes due tomorrow", 1), n("French PBA due Friday", 2), n("Daily brief", 3, "daily_brief"), n("Daily brief", 4, "daily_brief")]);
  assert.equal(out.length, 4);
});

});
