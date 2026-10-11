// Run with `npm test` (Node strips the types). The app imports without file
// extensions, which plain Node cannot resolve, so a resolve hook adds ".ts".
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

type Mod = typeof import("./event-types");

void (import("./event-types") as Promise<Mod>).then(({ EVENT_TYPES, isEventType, sanitizeEventProps }) => {
test("the Pipeline V2 event types", () => {
  assert.deepEqual(
    [...EVENT_TYPES].sort(),
    [
      "activity_cleared",
      "activity_row_expanded",
      "activity_viewed",
      "changeset_confirmed",
      "changeset_discarded",
      "changeset_drafted",
      "changeset_undone",
      "clarify_answered",
      "clarify_shown",
      "intent_classified",
      "match_confirmed",
      "match_corrected",
      "match_proposed",
      "pending_question_resolved",
      "preview_edited",
      "preview_shown",
      "request_received",
    ]
  );
  assert.equal(isEventType("preview_shown"), true);
  assert.equal(isEventType("page_view"), false);
  assert.equal(isEventType(42), false);
  // The events table's check: ^[a-z_]{1,64}$ (20261006000000_pipeline_v2_change_sets_and_events.sql).
  for (const t of EVENT_TYPES) assert.match(t, /^[a-z_]{1,64}$/);
});

test("structured props pass through", () => {
  const props = { source: "voice", intent: "add_to_plan", ops: 2, ms: 412.5, fast: true, plan: null, route: "fast:complete" };
  assert.deepEqual(sanitizeEventProps(props), props);
});

test("student free text never survives", () => {
  const out = sanitizeEventProps({
    request: "I have a test next week",
    title: "Draft ICF essay",
    email: "kid@school.edu",
    ok: "add_task",
  });
  assert.deepEqual(out, { ok: "add_task" });
});

test("bad keys, objects, arrays and non-finite numbers are dropped", () => {
  const out = sanitizeEventProps({
    "Bad Key": 1,
    _private: 1,
    nested: { a: 1 },
    list: ["a"],
    nan: Number.NaN,
    inf: Infinity,
    long: "x".repeat(65),
    good: 1,
  });
  assert.deepEqual(out, { good: 1 });
});

test("at most 16 props, and junk input gives an empty object", () => {
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
  assert.equal(Object.keys(sanitizeEventProps(many)).length, 16);
  assert.deepEqual(sanitizeEventProps(null), {});
  assert.deepEqual(sanitizeEventProps("text"), {});
  assert.deepEqual(sanitizeEventProps([1, 2]), {});
});
});
