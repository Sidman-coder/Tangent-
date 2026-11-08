// Run with `npm test`. The decision record (B9): outcome transitions and the
// row's columns (short request text, ids and scores only).
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

type Mod = typeof import("./decisions");

void (import("./decisions") as Promise<Mod>).then(({ canTransition, decisionColumns, isOutcome, OUTCOMES, OUTCOME_TRANSITIONS, MAX_REQUEST_TEXT, RETENTION_DAYS }) => {

test("drafted → confirmed → undone; drafted → discarded", () => {
  assert.ok(canTransition("drafted", "confirmed"));
  assert.ok(canTransition("confirmed", "undone"));
  assert.ok(canTransition("drafted", "discarded"));
  assert.ok(!canTransition("discarded", "confirmed"));
  assert.ok(!canTransition("drafted", "undone"));
});

test("asked → the answer's result; asked again once", () => {
  for (const to of ["answered", "drafted", "applied_instantly", "discarded", "failed", "asked"] as const) assert.ok(canTransition("asked", to), to);
  assert.ok(!canTransition("asked", "confirmed"));
  assert.ok(!canTransition("asked", "undone"));
});

test("instant changes can be undone; terminal outcomes go nowhere", () => {
  assert.ok(canTransition("applied_instantly", "undone"));
  for (const end of ["answered", "discarded", "undone", "failed"] as const) assert.deepEqual(OUTCOME_TRANSITIONS[end], [], end);
  assert.ok(!canTransition("undone", "confirmed"));
});

test("every outcome has a transition entry, and only known outcomes pass", () => {
  for (const o of OUTCOMES) assert.ok(Array.isArray(OUTCOME_TRANSITIONS[o]), o);
  assert.ok(isOutcome("confirmed"));
  assert.ok(!isOutcome("maybe"));
});

test("columns: request text ≤ 500, confidence clamped, ids only in the plan match", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const row = decisionColumns({
    source: "voice",
    requestText: "x".repeat(900),
    route: "draft",
    intent: "add_to_plan",
    confidence: 1.7,
    via: "router",
    planMatch: { decision: "unsure", candidates: [{ id, score: 0.91234 }, { id: "not-a-uuid", score: 0.8 }] },
    chosenPlanId: "nope",
    pendingQuestion: { action: "route", kind: "match", candidates: 3 },
    models: ["claude-haiku-4-5"],
    outcome: "asked",
  });
  assert.equal(row.request_text.length, MAX_REQUEST_TEXT);
  assert.equal(row.confidence, 1);
  assert.deepEqual(row.plan_match, { decision: "unsure", candidates: [{ id, score: 0.912 }] });
  assert.equal(row.chosen_plan_id, null);
  assert.deepEqual(row.pending_question, { action: "route", kind: "match", candidates: 3 });
  assert.equal(RETENTION_DAYS, 90);
});
});

void (import("./decisions") as Promise<typeof import("./decisions")>).then(({ outcomeForReply }) => {
  test("a reply's outcome: drafted, asked, applied at once, answered, failed", () => {
    assert.equal(outcomeForReply({ ok: true, action: "preview", changeSet: { id: "x" } }), "drafted");
    assert.equal(outcomeForReply({ ok: true, action: "clarify" }), "asked");
    assert.equal(outcomeForReply({ ok: true, action: "add_task", actionId: "a1" }), "applied_instantly");
    assert.equal(outcomeForReply({ ok: true, action: "chat_reply" }), "answered");
    assert.equal(outcomeForReply({ ok: true, action: "route_tangent" }), "answered");
    assert.equal(outcomeForReply({ ok: true, action: "error" }), "failed");
    assert.equal(outcomeForReply({ ok: false }), "failed");
    assert.equal(outcomeForReply({ ok: true, action: "cancelled" }), "discarded");
  });
});
