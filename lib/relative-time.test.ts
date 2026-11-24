// Run with `npm test`. Round 5A Phase 6: relative times and Today / Earlier.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

void (import("./relative-time") as Promise<typeof import("./relative-time")>).then(({ relativeTime, groupByDay }) => {
  // UTC days keep the test independent of the machine's zone.
  const dayOf = (at: Date) => at.toISOString().slice(0, 10);
  const now = new Date("2026-11-14T18:00:00Z"); // a Saturday

  test("relativeTime: minutes and hours today, then Yesterday, weekday, date", () => {
    assert.equal(relativeTime("2026-11-14T17:59:40Z", now, dayOf), "just now");
    assert.equal(relativeTime("2026-11-14T17:55:00Z", now, dayOf), "5m ago");
    assert.equal(relativeTime("2026-11-14T16:00:00Z", now, dayOf), "2h ago");
    assert.equal(relativeTime("2026-11-14T00:10:00Z", now, dayOf), "17h ago");
    assert.equal(relativeTime("2026-11-13T23:00:00Z", now, dayOf), "Yesterday");
    assert.equal(relativeTime("2026-11-09T12:00:00Z", now, dayOf), "Mon");
    assert.equal(relativeTime("2026-11-03T12:00:00Z", now, dayOf), "Nov 3");
    assert.equal(relativeTime("not a date", now, dayOf), "");
  });

  test("relativeTime: uses the student's day, not the machine's", () => {
    // 01:00 UTC on the 14th is still the 13th in New York (UTC-5).
    const ny = (at: Date) => new Date(at.getTime() - 5 * 3600000).toISOString().slice(0, 10);
    assert.equal(relativeTime("2026-11-14T01:00:00Z", now, ny), "Yesterday");
  });

  test("groupByDay: Today and Earlier, order kept", () => {
    const list = [
      { id: "a", timestamp: "2026-11-14T17:00:00Z" },
      { id: "b", timestamp: "2026-11-14T09:00:00Z" },
      { id: "c", timestamp: "2026-11-13T20:00:00Z" },
      { id: "d", timestamp: "2026-11-01T20:00:00Z" },
    ];
    const g = groupByDay(list, now, dayOf);
    assert.deepEqual(g.today.map((n) => n.id), ["a", "b"]);
    assert.deepEqual(g.earlier.map((n) => n.id), ["c", "d"]);
  });
});
