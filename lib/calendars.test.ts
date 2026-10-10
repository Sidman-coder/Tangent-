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

type Cals = typeof import("./calendars");
void (import("./calendars") as Promise<Cals>).then(({ CAL_OTHER, CAL_SCHOOL, calendarGroupOf, parseCalendarGroup }) => {
const t = (over: Record<string, unknown>) => ({ title: "x", ...over }) as Parameters<typeof calendarGroupOf>[0];

test("old calendar ids map onto School / No school", () => {
  assert.equal(calendarGroupOf(t({ calendarId: "cal_study" })), CAL_SCHOOL);
  assert.equal(calendarGroupOf(t({ calendarId: "cal_personal" })), CAL_OTHER);
  assert.equal(calendarGroupOf(t({ calendarId: "cal_work" })), CAL_OTHER);
  assert.equal(calendarGroupOf(t({ calendarId: "cal_1234" })), CAL_OTHER);
});

test("canvas and school kind are always School", () => {
  assert.equal(calendarGroupOf(t({ calendarId: "cal_personal", source: "canvas" })), CAL_SCHOOL);
  assert.equal(calendarGroupOf(t({ calendarId: "cal_work", kind: "school" })), CAL_SCHOOL);
});

test("an explicit group wins", () => {
  assert.equal(calendarGroupOf(t({ calendarId: CAL_OTHER, kind: "school" })), CAL_OTHER);
});

test("no calendar falls back to the title", () => {
  assert.equal(calendarGroupOf(t({ title: "Chem quiz review" })), CAL_SCHOOL);
  assert.equal(calendarGroupOf(t({ title: "Robotics practice", calendarId: "cal_all" })), CAL_OTHER);
  assert.equal(calendarGroupOf(t({ title: "Map out weekend" })), CAL_OTHER);
});

test("parses what the AI might say", () => {
  assert.equal(parseCalendarGroup("School"), CAL_SCHOOL);
  assert.equal(parseCalendarGroup("no school"), CAL_OTHER);
  assert.equal(parseCalendarGroup("cal_work"), CAL_OTHER);
  assert.equal(parseCalendarGroup("cal_all"), null);
});
});
