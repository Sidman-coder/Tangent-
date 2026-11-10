// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { TODAYS_SUMMARY_ENABLED, visibleNotifications } from "./feature-flags.ts";

const list = [
  { id: "a", type: "reminder" },
  { id: "b", type: "daily_brief" },
  { id: "c", type: "overdue" },
];

test("Today's summary is off for now", () => {
  assert.equal(TODAYS_SUMMARY_ENABLED, false);
});

test("with the summary off, no daily brief reaches the list, popups or desktop alerts", () => {
  assert.deepEqual(visibleNotifications(list).map((n) => n.id), ["a", "c"]);
});

test("turning the flag back on shows the summary again", () => {
  assert.deepEqual(visibleNotifications(list, true).map((n) => n.id), ["a", "b", "c"]);
});
