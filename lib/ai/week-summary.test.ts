// Run with `npm test`. Round 5A 2.2: "Reading your week" for the brief call.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./week-summary");

void (import("./week-summary.ts" as string) as Promise<Mod>).then(({ weekSummary, datesBetween }) => {
  test("dates between, inclusive, across a month end", () => {
    assert.deepEqual(datesBetween("2026-11-29", "2026-12-02"), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  test("one line per day: busy days name their tasks, done tasks don't count", () => {
    const out = weekSummary(
      [
        { title: "Soccer", date: "2026-11-16", time: "4:00pm" },
        { title: "Essay draft", date: "2026-11-16" },
        { title: "Old thing", date: "2026-11-17", completed: true },
        { title: "Outside window", date: "2026-11-30" },
      ],
      ["2026-11-16", "2026-11-17"]
    );
    assert.equal(out, "Mon 2026-11-16: Soccer 4:00pm, Essay draft (2 tasks)\nTue 2026-11-17: free");
  });
});
