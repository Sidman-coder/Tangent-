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

type Mod = typeof import("./task-when");
void (import("./task-when") as Promise<Mod>).then(({ formatTaskWhen, formatTaskDay, taskEndTime }) => {
  const NY = "America/New_York";
  const NOW = new Date("2026-11-04T15:00:00Z");

  test("a timed task today uses the same format as any other day", () => {
    assert.equal(formatTaskWhen({ date: "2026-11-04", time: "15:30" }, NOW, NY), "Wed, Nov 4 · 3:30 PM");
  });

  test("another day names its own weekday", () => {
    assert.equal(formatTaskWhen({ date: "2026-11-09", time: "08:05" }, NOW, NY), "Mon, Nov 9 · 8:05 AM");
  });

  test("an untimed task reads Anytime", () => {
    assert.equal(formatTaskWhen({ date: "2026-11-05", time: "" }, NOW, NY), "Thu, Nov 5 · Anytime");
  });

  test("a range in one half of the day shares its AM or PM", () => {
    assert.equal(
      formatTaskWhen({ date: "2026-11-04", time: "15:30", endTime: "16:15" }, NOW, NY),
      "Wed, Nov 4 · 3:30–4:15 PM"
    );
  });

  test("a range across noon writes both", () => {
    assert.equal(
      formatTaskWhen({ date: "2026-11-04", time: "11:30", endTime: "12:15" }, NOW, NY),
      "Wed, Nov 4 · 11:30 AM–12:15 PM"
    );
  });

  test("a range across midnight writes both", () => {
    assert.equal(
      formatTaskWhen({ date: "2026-11-04", time: "23:30", endTime: "00:15" }, NOW, NY),
      "Wed, Nov 4 · 11:30 PM–12:15 AM"
    );
  });

  test("noon and midnight are 12, not 0", () => {
    assert.equal(formatTaskWhen({ date: "2026-11-04", time: "12:00" }, NOW, NY), "Wed, Nov 4 · 12:00 PM");
    assert.equal(formatTaskWhen({ date: "2026-11-04", time: "00:00" }, NOW, NY), "Wed, Nov 4 · 12:00 AM");
  });

  test("the weekday holds on both clock-change days", () => {
    // Clocks go forward on Sun, Mar 8 2026 and back on Sun, Nov 1 2026 in New York.
    assert.equal(
      formatTaskWhen({ date: "2026-03-08", time: "02:30" }, new Date("2026-03-08T12:00:00Z"), NY),
      "Sun, Mar 8 · 2:30 AM"
    );
    assert.equal(
      formatTaskWhen({ date: "2026-11-01", time: "01:30" }, new Date("2026-11-01T12:00:00Z"), NY),
      "Sun, Nov 1 · 1:30 AM"
    );
  });

  test("the year comes from the student's timezone, not the server's", () => {
    // Still Dec 31 2026 in Los Angeles, already 2027 in UTC.
    const at = new Date("2027-01-01T03:00:00Z");
    assert.equal(formatTaskDay("2026-12-31", at, "America/Los_Angeles"), "Thu, Dec 31");
    assert.equal(formatTaskDay("2026-12-31", at, "UTC"), "Thu, Dec 31, 2026");
  });

  test("a date in another year shows the year", () => {
    assert.equal(formatTaskWhen({ date: "2028-01-04", time: "" }, NOW, NY), "Tue, Jan 4, 2028 · Anytime");
  });

  test("an unreadable date or time is shown as it is, not as NaN", () => {
    assert.equal(formatTaskWhen({ date: "soon", time: "after lunch" }, NOW, NY), "soon · after lunch");
  });

  test("taskEndTime reads a step's length and wraps past midnight", () => {
    assert.equal(taskEndTime({ time: "15:30", notes: "TIME: 45 min" }), "16:15");
    assert.equal(taskEndTime({ time: "23:30", notes: "TIME: 45 min" }), "00:15");
  });

  test("taskEndTime reads a School Block's Until note", () => {
    assert.equal(taskEndTime({ time: "08:00", notes: "Until 3:00 PM" }), "15:00");
  });

  test("taskEndTime is null without a start or a length", () => {
    assert.equal(taskEndTime({ time: "", notes: "TIME: 45 min" }), null);
    assert.equal(taskEndTime({ time: "15:30" }), null);
  });
});
