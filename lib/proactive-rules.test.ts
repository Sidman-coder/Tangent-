// Run with `npm test`. Overnight 2, Phase 4: proactive notifications are
// decided in code, at most once per 4 hours, with no model call when nothing
// qualifies. Seeded dates: "now" is Mon 2026-11-23, 4:00 PM.
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

void (import("./proactive-rules") as Promise<typeof import("./proactive-rules")>).then(
  ({ proactiveDue, proactiveFindings, hasFindings, overdueNotice, dueSoonNotices, rescheduleNotice, PROACTIVE_EVERY_MS }) => {
    type T = import("./types").Task;
    const task = (p: Partial<T> & { id: string; title: string; date: string }): T => ({ completed: false, ...p }) as T;
    const now = { date: "2026-11-23", minutes: 16 * 60 };
    const day = (d: string) => ({ "2026-11-22": "yesterday", "2026-11-21": "Sat, Nov 21", "2026-11-23": "today", "2026-11-24": "tomorrow", "2026-11-25": "Wed, Nov 25" })[d] ?? d;
    const clock = (t: string) => (t === "16:30" ? "4:30 PM" : t);

    test("proactiveDue: once per 4 hours", () => {
      const at = new Date("2026-11-23T16:00:00Z");
      assert.equal(proactiveDue(undefined, at), true);
      assert.equal(proactiveDue("not a date", at), true);
      assert.equal(proactiveDue(new Date(at.getTime() - PROACTIVE_EVERY_MS + 60_000).toISOString(), at), false);
      assert.equal(proactiveDue(new Date(at.getTime() - PROACTIVE_EVERY_MS).toISOString(), at), true);
    });

    test("nothing qualifies: no findings (so no notification and no model call)", () => {
      const tasks = [
        task({ id: "a", title: "Read ch. 4", date: "2026-11-24", time: "16:30" }),
        task({ id: "b", title: "Old essay", date: "2026-11-20", time: "23:59", completed: true }),
        task({ id: "c", title: "Essay due", date: "2026-11-27", time: "23:59" }),
      ];
      assert.equal(hasFindings(proactiveFindings(tasks, now)), false);
    });

    test("overdue, due within 48 h and reschedule are told apart", () => {
      const tasks = [
        task({ id: "step", title: "Draft club pitch", date: "2026-11-22", time: "16:30", planId: "p1" }),
        task({ id: "due", title: "History worksheet", date: "2026-11-21", time: "23:59" }),
        task({ id: "soon", title: "Chem lab report", date: "2026-11-24", time: "23:59", planId: "p2" }),
        task({ id: "prep", title: "Write lab conclusion", date: "2026-11-23", time: "19:00", planId: "p2" }),
        task({ id: "far", title: "English essay", date: "2026-11-26", time: "23:59" }),
        task({ id: "school", title: "School", date: "2026-11-20", time: "08:00" }),
      ];
      const f = proactiveFindings(tasks, now, (t) => t.title === "School");
      assert.deepEqual(f.reschedule.map((t) => t.id), ["step"]);
      assert.deepEqual(f.overdue.map((t) => t.id), ["due"]);
      assert.deepEqual(f.dueSoon.map((t) => t.id), ["soon"]);

      const due = dueSoonNotices(f.dueSoon, tasks, now, day, clock);
      assert.equal(due[0].title, "Due soon: Chem lab report");
      assert.equal(due[0].body, "Due tomorrow, end of day. Next step for it: “Write lab conclusion”, today.");
      assert.equal(due[0].actionData?.taskId, "soon");
    });

    test("an exam with a start time is due work, never offered a move", () => {
      const f = proactiveFindings([task({ id: "x", title: "AP Chem final", date: "2026-11-22", time: "09:00" })], now);
      assert.deepEqual(f.reschedule, []);
      assert.deepEqual(f.overdue.map((t) => t.id), ["x"]);
    });

    test("overdue templates: one names it; several become one line the bell merges", () => {
      const one = overdueNotice([task({ id: "a", title: "History worksheet", date: "2026-11-21" })], day)!;
      assert.equal(one.title, "Still open: History worksheet");
      assert.match(one.body, /It was for Sat, Nov 21\./);
      const many = overdueNotice(
        [task({ id: "a", title: "History worksheet", date: "2026-11-22" }), task({ id: "b", title: "Spanish vocab", date: "2026-11-21" })],
        day
      )!;
      assert.equal(many.title, "2 things are past due");
      assert.equal(many.actionData, undefined);
      for (const n of [one, many]) assert.doesNotMatch(`${n.title} ${n.body}`, /missed|streak|behind|should have/i);
      assert.equal(overdueNotice([], day), null);
    });

    test("reschedule offer: code's slot and wording when Haiku has none", () => {
      const n = rescheduleNotice(task({ id: "s", title: "Draft club pitch", date: "2026-11-22" }), { date: "2026-11-23", time: "16:30" }, day, clock);
      assert.equal(n.type, "reschedule_offer");
      assert.equal(n.body, "It was for yesterday. Today at 4:30 PM is open.");
      assert.deepEqual(n.actionData, { taskId: "s", suggestedDate: "2026-11-23", suggestedTime: "16:30" });
    });
  }
);
