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

type D = typeof import("./notification-dedupe");
void (import("./notification-dedupe") as Promise<D>).then(({ collapseDuplicates, mergeOverdue, isAggregateOverdue }) => {

const n = (title: string, minute: number, type = "reminder") => ({ title, type, timestamp: `2026-10-11T21:${String(minute).padStart(2, "0")}:00Z` });

test("the same reminder shows once, newest kept", () => {
  const out = collapseDuplicates([
    n("Envelope Quotes due tomorrow", 10),
    n("Envelope Quotes due tomorrow", 30),
    n("Two deadlines on Tuesday", 20),
    n("Multiple deadlines Tuesday", 25),
    n("Two deadlines Tuesday", 5),
    n("Prep time for speaking assessment", 1),
  ]);
  assert.deepEqual(out.map((x) => `${x.title}@${x.timestamp.slice(14, 16)}`), [
    "Envelope Quotes due tomorrow@30",
    "Multiple deadlines Tuesday@25",
    "Prep time for speaking assessment@01",
  ]);
});

test("different reminders and daily briefs are kept", () => {
  const out = collapseDuplicates([n("Envelope Quotes due tomorrow", 1), n("French PBA due Friday", 2), n("Daily brief", 3, "daily_brief"), n("Daily brief", 4, "daily_brief")]);
  assert.equal(out.length, 4);
});


test("Round 5A: an aggregate overdue alert absorbs the single ones", () => {
  const list = [
    { id: "agg", type: "overdue_task", title: "Six tasks are overdue", timestamp: "2026-11-14T00:32:00Z" },
    { id: "r1", type: "reschedule_offer", title: "Move Reel post task", timestamp: "2026-11-14T00:32:00Z" },
    { id: "o1", type: "overdue_task", title: "Post your first Reel is overdue", timestamp: "2026-11-14T00:31:00Z", duplicateIds: ["o1b"] },
    { id: "o2", type: "overdue_task", title: "Define your niche is overdue", timestamp: "2026-11-13T20:00:00Z" },
    { id: "u1", type: "upcoming_deadline", title: "Reel analytics due tomorrow", timestamp: "2026-11-13T20:00:00Z" },
    { id: "agg-old", type: "overdue_task", title: "3 tasks are overdue", timestamp: "2026-11-12T20:00:00Z" },
  ];
  const out = mergeOverdue(list);
  assert.deepEqual(out.map((n) => n.id), ["agg", "r1", "u1"], "reschedule offers and other alerts stay");
  assert.deepEqual(out[0].duplicateIds, ["o1", "o1b", "o2", "agg-old"]);
});

test("Round 5A: no aggregate, nothing merged", () => {
  const list = [
    { id: "o1", type: "overdue_task", title: "Post your first Reel is overdue", timestamp: "2026-11-14T00:31:00Z" },
    { id: "o2", type: "overdue_task", title: "Define your niche is overdue", timestamp: "2026-11-13T20:00:00Z" },
  ];
  assert.equal(mergeOverdue(list), list);
  assert.ok(isAggregateOverdue({ type: "overdue_task", title: "You have 4 overdue tasks" }));
  assert.ok(isAggregateOverdue({ type: "overdue_task", title: "Six Instagram tasks are overdue" }));
  assert.ok(isAggregateOverdue({ type: "overdue_task", title: "3 things are past due" }));
  assert.ok(!isAggregateOverdue({ type: "overdue_task", title: "Essay draft is overdue" }));
  assert.ok(!isAggregateOverdue({ type: "upcoming_deadline", title: "Six tasks are overdue" }));
});

});
