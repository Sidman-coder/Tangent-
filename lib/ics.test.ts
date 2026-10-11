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

type Ics = typeof import("./ics");
void (import("./ics") as Promise<Ics>).then(({ parseIcs }) => {

const cal = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}END:VCALENDAR\r\n`;

test("reads timed, all-day and folded events in the window", () => {
  const text = cal(
    "BEGIN:VEVENT\r\nSUMMARY:Robotics meeting\r\nDTSTART:20261013T153000\r\nLOCATION:Room 4\\, B wing\r\nEND:VEVENT\r\n" +
      "BEGIN:VEVENT\r\nSUMMARY:Long title that is fold\r\n ed onto two lines\r\nDTSTART;VALUE=DATE:20261015\r\nEND:VEVENT\r\n" +
      "BEGIN:VEVENT\r\nSUMMARY:Too late\r\nDTSTART:20270101T090000\r\nEND:VEVENT\r\n"
  );
  const out = parseIcs(text, "2026-10-11", "2026-12-10");
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { title: "Robotics meeting", date: "2026-10-13", time: "15:30", allDay: false, location: "Room 4, B wing" });
  assert.equal(out[1].title, "Long title that is folded onto two lines");
  assert.equal(out[1].allDay, true);
});

test("expands a weekly repeat inside the window and skips cancelled events", () => {
  const text = cal(
    "BEGIN:VEVENT\r\nSUMMARY:Piano\r\nDTSTART:20261012T170000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=4\r\nEND:VEVENT\r\n" +
      "BEGIN:VEVENT\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20261014T090000\r\nEND:VEVENT\r\n"
  );
  const out = parseIcs(text, "2026-10-11", "2026-12-10");
  assert.deepEqual(out.map((e) => e.date), ["2026-10-12", "2026-10-15", "2026-10-19", "2026-10-22"]);
  assert.ok(out.every((e) => e.title === "Piano" && e.time === "17:00"));
});

test("skips occurrences deleted from a repeat (EXDATE), including repeated lines", () => {
  const text = cal(
    "BEGIN:VEVENT\r\nSUMMARY:FRC build\r\nDTSTART;TZID=America/New_York:20261013T160000\r\nRRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261023T035959Z\r\nEXDATE;TZID=America/New_York:20261015T160000\r\nEXDATE;TZID=America/New_York:20261020T160000\r\nEND:VEVENT\r\n"
  );
  const out = parseIcs(text, "2026-10-11", "2026-12-10");
  assert.deepEqual(out.map((e) => e.date), ["2026-10-13", "2026-10-22"]);
});

});
