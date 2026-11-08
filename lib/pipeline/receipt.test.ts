// Run with `npm test`. Master fix Phase 4: the confirmed card's summary.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./receipt");
type Ops = Parameters<Mod["receiptView"]>[0]["ops"];

void (import("./receipt.ts" as string) as Promise<Mod>).then(({ receiptView }) => {
  const task = (date: string, title = "Practice") => ({ op: "add_task" as const, title, date, time: "16:00", plan_ref: "p" });

  test("a new project: headline with its name, three lines, then See all by week", () => {
    const ops = [
      { op: "create_plan" as const, ref: "p", title: "SAT prep" },
      task("2026-10-13"),
      task("2026-10-15"),
      task("2026-10-20"),
      task("2026-10-22"),
      task("2026-10-27"),
    ] as unknown as Ops;
    const lines = ["New plan: SAT prep", "Tue Oct 13", "Thu Oct 15", "Tue Oct 20", "Thu Oct 22", "Tue Oct 27"];
    const r = receiptView({ ops }, lines);
    assert.equal(r.headline, "Added “SAT prep” · 5 sessions");
    assert.deepEqual(r.lines, ["Tue Oct 13", "Thu Oct 15", "Tue Oct 20"]);
    assert.equal(r.total, 5);
    assert.deepEqual(r.weeks.map((w) => w.label), ["Week of Oct 12", "Week of Oct 19", "Week of Oct 26"]);
    assert.deepEqual(r.weeks[1].lines, ["Tue Oct 20", "Thu Oct 22"]);
    // Duplicates skipped on confirm: the headline counts what was created.
    assert.equal(receiptView({ ops }, lines, 4).headline, "Added “SAT prep” · 4 sessions");
  });

  test("small changes list everything and name each kind", () => {
    const ops = [
      { op: "move_task", task_id: "00000000-0000-4000-8000-000000000001", date: "2026-10-14" },
      { op: "delete_task", task_id: "00000000-0000-4000-8000-000000000002" },
    ] as unknown as Ops;
    const r = receiptView({ ops }, ["Move Essay to Wed", "Delete Quiz"]);
    assert.equal(r.headline, "Changed 1 item · Deleted 1 task");
    assert.deepEqual(r.lines, ["Move Essay to Wed", "Delete Quiz"]);
    assert.equal(r.total, 2);
  });
});
