// Run with `npm test` (Node's built-in runner; Node strips the types).
// The app imports without file extensions, which plain Node cannot resolve, so
// a resolve hook adds ".ts" before the modules under test are loaded.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeOp } from "./changeset";

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

type Mod = typeof import("./draft");

void (import("./draft") as Promise<Mod>).then(({ taskOp, planOps, buildDraft, summarize, editOps, parseDraftEdit }) => {
  const USER = "33333333-3333-4333-8333-000000000001";
  const ID = "44444444-4444-4444-8444-000000000001";
  const draft = (ops: ChangeOp[], assumptions?: string[]) =>
    buildDraft({
      id: ID,
      userId: USER,
      source: "typed",
      requestText: "make me an SAT plan",
      summary: "Proposed",
      intent: "new_plan",
      ops,
      assumptions,
      now: "2026-10-06T12:00:00.000Z",
    });

  // ─── taskOp ─────────────────────────────────────────────────────────────────

  test("taskOp keeps the fields the AI produced", () => {
    const op = taskOp({
      title: " Read ch. 3 ",
      date: "2026-10-07",
      time: "16:30",
      calendarId: "cal_school",
      notes: "pages 40-60",
      kind: "school",
      startAction: "Open the book",
      resources: [{ label: "Khan", url: "https://www.khanacademy.org/" }],
    });
    assert.deepEqual(op, {
      op: "add_task",
      title: "Read ch. 3",
      date: "2026-10-07",
      time: "16:30",
      calendarId: "cal_school",
      notes: "pages 40-60",
      kind: "school",
      startAction: "Open the book",
      resources: [{ label: "Khan", url: "https://www.khanacademy.org/" }],
    });
  });

  test("taskOp trims what the schema would reject instead of failing", () => {
    const op = taskOp({
      title: "x".repeat(300),
      date: "2026-10-07",
      time: "4pm",
      kind: "homework",
      startAction: "  ",
      resources: [
        { label: "ok", url: "https://example.com/a" },
        { label: "bad", url: "not a url" },
        { label: " ", url: "https://example.com/b" },
      ],
    });
    assert.equal(op.title.length, 200);
    assert.equal(op.time, "");
    assert.equal(op.kind, undefined);
    assert.equal(op.startAction, undefined);
    assert.deepEqual(op.resources, [{ label: "ok", url: "https://example.com/a" }]);
    assert.equal(taskOp({ title: "   ", date: "2026-10-07" }).title, "Untitled task");
  });

  test("taskOp links to a new plan by ref, or an existing one by id", () => {
    assert.equal(taskOp({ title: "a", date: "2026-10-07" }, { plan_ref: "p1" }).plan_ref, "p1");
    const existing = taskOp({ title: "a", date: "2026-10-07" }, { plan_id: "p-uuid" });
    assert.equal(existing.plan_id, "p-uuid");
    assert.equal(existing.plan_ref, undefined);
  });

  // ─── planOps / buildDraft / summarize ───────────────────────────────────────

  test("planOps: one create_plan, then its tasks", () => {
    const ops = planOps("SAT Prep", [
      { title: "Diagnostic", date: "2026-10-07" },
      { title: "Algebra", date: "2026-10-08" },
    ]);
    assert.equal(ops.length, 3);
    assert.deepEqual(ops[0], { op: "create_plan", ref: "p1", title: "SAT Prep" });
    assert.ok(ops.slice(1).every((o) => o.op === "add_task" && o.plan_ref === "p1"));
  });

  test("buildDraft validates and headlines the change", () => {
    const r = draft(planOps("SAT Prep", [{ title: "Diagnostic", date: "2026-10-07" }]), [" Assumed a week ", ""]);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.changeSet.status, "draft");
    assert.equal(r.changeSet.summary, "New plan \"SAT Prep\" with 1 task");
    assert.deepEqual(r.changeSet.assumptions, ["Assumed a week"]);
    assert.equal(r.changeSet.action_id, null);
  });

  test("buildDraft refuses an op the schema rejects", () => {
    assert.equal(draft([{ op: "add_task", title: "a", date: "next tuesday" }]).ok, false);
  });

  test("summarize: single add, plan, otherwise the fallback", () => {
    assert.equal(summarize([taskOp({ title: "Dentist", date: "2026-10-07" })], "f"), "Add \"Dentist\"");
    const two = planOps("ICF", [
      { title: "a", date: "2026-10-07" },
      { title: "b", date: "2026-10-08" },
    ]);
    assert.equal(summarize(two, "f"), "New plan \"ICF\" with 2 tasks");
    const loose = [taskOp({ title: "a", date: "2026-10-07" }), taskOp({ title: "b", date: "2026-10-07" })];
    assert.equal(summarize(loose, "fallback"), "fallback");
  });

  // ─── editOps / parseDraftEdit ──────────────────────────────────────────────

  const plan = () =>
    planOps("SAT", [
      { title: "a", date: "2026-10-07" },
      { title: "b", date: "2026-10-08", time: "09:00" },
    ]);

  test("removing a task keeps the plan while it has others", () => {
    const r = editOps(plan(), { type: "remove", index: 1 });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.ops.map((o) => o.op), ["create_plan", "add_task"]);
  });

  test("removing a plan's last task removes the plan; leaving nothing is refused", () => {
    const one = planOps("SAT", [{ title: "a", date: "2026-10-07" }]);
    const r = editOps(one, { type: "remove", index: 1 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Discard/);
    const mixed: ChangeOp[] = [...one, taskOp({ title: "loose", date: "2026-10-09" })];
    const m = editOps(mixed, { type: "remove", index: 1 });
    assert.ok(m.ok);
    if (m.ok) assert.deepEqual(m.ops, [mixed[2]]);
  });

  test("removing the plan removes its tasks", () => {
    const mixed: ChangeOp[] = [...plan(), taskOp({ title: "loose", date: "2026-10-09" })];
    const r = editOps(mixed, { type: "remove", index: 0 });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(r.ops, [mixed[3]]);
  });

  test("date and time edits apply to tasks only", () => {
    const d = editOps(plan(), { type: "date", index: 2, date: "2026-10-10" });
    assert.ok(d.ok);
    if (d.ok) assert.equal((d.ops[2] as { date: string }).date, "2026-10-10");
    const t = editOps(plan(), { type: "time", index: 1, time: "" });
    assert.ok(t.ok);
    if (t.ok) assert.equal((t.ops[1] as { time?: string }).time, "");
    assert.equal(editOps(plan(), { type: "date", index: 0, date: "2026-10-10" }).ok, false);
    assert.equal(editOps(plan(), { type: "remove", index: 9 }).ok, false);
  });

  test("parseDraftEdit accepts only well-formed edits", () => {
    assert.deepEqual(parseDraftEdit({ type: "remove", index: 2 }), { type: "remove", index: 2 });
    assert.deepEqual(parseDraftEdit({ type: "date", index: 0, date: "2026-10-10" }), { type: "date", index: 0, date: "2026-10-10" });
    assert.deepEqual(parseDraftEdit({ type: "time", index: 0, time: "" }), { type: "time", index: 0, time: "" });
    assert.equal(parseDraftEdit({ type: "time", index: 0, time: "25:00" }), null);
    assert.equal(parseDraftEdit({ type: "date", index: 0, date: "10/10/2026" }), null);
    assert.equal(parseDraftEdit({ type: "remove", index: -1 }), null);
    assert.equal(parseDraftEdit({ type: "remove", index: 1.5 }), null);
    assert.equal(parseDraftEdit({ type: "rename", index: 0 }), null);
    assert.equal(parseDraftEdit(null), null);
  });
});
