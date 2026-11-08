import assert from "node:assert/strict";
import test from "node:test";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { buildMonthGrid, previewRange, weekLabel, type MonthGridItem } from "./month-grid.ts";

const item = (key: string, date: string, kind: "new" | "existing" = "new"): MonthGridItem => ({
  key, date, kind, title: key, when: date,
});

test("month grid starts on Sunday and dims adjacent month days", () => {
  const grid = buildMonthGrid("2026-11-01", 0, [item("a", "2026-11-05")], "2026-11-05");
  assert.equal(grid.length, 5);
  assert.equal(grid[0][0].date, "2026-11-01");
  assert.equal(grid[0][4].isToday, true);
  assert.equal(grid[0][4].newItems[0].key, "a");
  assert.equal(grid.at(-1)?.at(-1)?.date, "2026-12-05");
  assert.equal(grid.at(-1)?.at(-1)?.inMonth, false);
});

test("Monday and Saturday starts shift the first cell", () => {
  assert.equal(buildMonthGrid("2026-11-01", 1, [])[0][0].date, "2026-10-26");
  assert.equal(buildMonthGrid("2026-11-01", 6, [])[0][0].date, "2026-10-31");
});

test("a six-week month and February have only the needed rows", () => {
  assert.equal(buildMonthGrid("2026-08-01", 0, []).length, 6);
  assert.equal(buildMonthGrid("2027-02-01", 1, []).length, 4);
});

test("grid caps visible items and reports overflow separately", () => {
  const items = [0, 1, 2, 3].map((n) => item(`n${n}`, "2026-11-05"))
    .concat([0, 1, 2, 3, 4].map((n) => item(`e${n}`, "2026-11-05", "existing")));
  const cell = buildMonthGrid("2026-11-01", 0, items)[0][4];
  assert.equal(cell.newItems.length, 2);
  assert.equal(cell.newOverflow, 2);
  assert.equal(cell.existing.length, 3);
  assert.equal(cell.existingOverflow, 2);
});

test("preview range and week label follow the first and last new step", () => {
  assert.deepEqual(previewRange([item("a", "2026-11-04"), item("b", "2026-12-11"), item("old", "2026-10-01", "existing")]), {
    first: "2026-11-04", last: "2026-12-11", minMonth: "2026-11-01", maxMonth: "2026-12-01",
  });
  assert.equal(weekLabel("2026-11-02"), "Nov 2–8");
  assert.equal(weekLabel("2026-11-30"), "Nov 30–Dec 6");
});
