// Run with `npm test`. A resolve hook adds ".ts" to extensionless imports.
import * as nodeModule from "node:module";
import test from "node:test";
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

type Mod = typeof import("./analytics-events");

void (import("./analytics-events") as Promise<Mod>).then(({ PILOT_EVENTS, ONCE_PER_USER, isPilotEvent, pilotProps, isWeek2Window }) => {
  test("pilot events: names fit the events table and once-events are known", () => {
    for (const name of PILOT_EVENTS) assert.match(name, /^[a-z_]{1,64}$/);
    for (const name of ONCE_PER_USER) assert.ok(PILOT_EVENTS.includes(name));
    assert.equal(isPilotEvent("task_done"), true);
    assert.equal(isPilotEvent("password_typed"), false);
    assert.equal(isPilotEvent(42), false);
  });

  test("pilot props keep allowlisted ids, counts and tokens and drop everything else", () => {
    const props = pilotProps({
      task_id: "3f1c2d4e-0000-4000-8000-000000000001",
      count: 3,
      source: "quick",
      slot_key: "deadline",
      title: "Study for my chem test",
      answer: "I have soccer on Tuesdays",
      kind: "Free text with spaces and Caps",
    });
    assert.deepEqual(Object.keys(props).sort(), ["count", "slot_key", "source", "task_id"]);
    assert.equal(props.count, 3);
    assert.deepEqual(pilotProps(null), {});
    assert.deepEqual(pilotProps(["count"]), {});
  });

  test("week 2 return is an open on day 7 through day 14 after signup", () => {
    const signup = "2026-11-01T12:00:00Z";
    const at = (iso: string) => isWeek2Window(signup, new Date(iso));
    assert.equal(at("2026-11-07T12:00:00Z"), false);
    assert.equal(at("2026-11-08T12:00:00Z"), true);
    assert.equal(at("2026-11-15T11:00:00Z"), true);
    assert.equal(at("2026-11-16T12:00:00Z"), false);
    assert.equal(isWeek2Window("not a date"), false);
  });
});
