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

type Mod = typeof import("./source-read");
void (import("./source-read") as Promise<Mod>).then(({ joinSources, toolReadSucceeded }) => {
test("a not-connected Gmail or Calendar reply is not a source that was read", () => {
  assert.equal(toolReadSucceeded({ error: "google_not_connected", detail: "coming soon" }), false);
  assert.equal(toolReadSucceeded({ error: "google_calendar_not_connected" }), false);
});

test("an empty Canvas feed is not a source that was read", () => {
  assert.equal(toolReadSucceeded({ connected: false, note: "No Canvas items yet" }), false);
});

test("real data counts, even when the list is empty", () => {
  assert.equal(toolReadSucceeded({ upcoming: [], overdue: [] }), true);
  assert.equal(toolReadSucceeded({ tasks: [{ id: "1" }] }), true);
});

test("garbage payloads do not count", () => {
  assert.equal(toolReadSucceeded(null), false);
  assert.equal(toolReadSucceeded("oops"), false);
});

test("joinSources reads naturally", () => {
  assert.equal(joinSources([]), "");
  assert.equal(joinSources(["Canvas"]), "Canvas");
  assert.equal(joinSources(["Canvas", "Gmail"]), "Canvas and Gmail");
  assert.equal(joinSources(["Canvas", "Gmail", "your calendar"]), "Canvas, Gmail and your calendar");
});
});
