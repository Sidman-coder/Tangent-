// Run with `npm test`. Reading how the student behaves: follow-through, work
// days, planning style and what they ask task chats.
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { behaviourLines, classifyAsk, followThrough, workDays, planningStyle, askPattern, toCode, isStepEventKind } from "./observations.ts";
import type { StepEvent, StepEventKind } from "./observations";

const ev = (kind: StepEventKind, extra: Partial<StepEvent> = {}): StepEvent => ({ kind, hour: 18, weekday: 2, minutes: null, actualMinutes: null, code: null, ...extra });
const many = (n: number, kind: StepEventKind, extra: Partial<StepEvent> = {}) => Array.from({ length: n }, () => ev(kind, extra));

test("classifyAsk: sorts task-chat questions by what they're after", () => {
  assert.equal(classifyAsk("How do I start this essay?"), "how_to");
  assert.equal(classifyAsk("what is a thesis statement"), "explain");
  assert.equal(classifyAsk("Is this intro good enough?"), "check");
  assert.equal(classifyAsk("I'm stuck on question 3"), "stuck");
  assert.equal(classifyAsk("how long will this take"), "time");
  assert.equal(classifyAsk("I can't focus at all"), "motivation");
  assert.equal(classifyAsk("ok thanks"), "other");
});

test("toCode: slot keys and intents become short snake codes", () => {
  assert.equal(toCode("hoursPerWeek"), "hours_per_week");
  assert.equal(toCode("plan_removal"), "plan_removal");
  assert.equal(toCode("123"), null);
});

test("behaviour kinds are accepted kinds", () => {
  for (const k of ["chat_ask", "plan_accept", "plan_edit", "plan_reject", "plan_stop", "question_answer", "question_skip"]) assert.ok(isStepEventKind(k));
  assert.ok(!isStepEventKind("chat_text"));
});

test("followThrough: done vs put off, with the usual reason once it repeats", () => {
  const f = followThrough([...many(3, "done"), ...many(2, "not_today", { code: "no_time" }), ev("skipped"), ev("created")]);
  assert.equal(f.samples, 6);
  assert.equal(f.value.rate, 0.5);
  assert.equal(f.value.topReason, "no_time");
  assert.equal(followThrough([ev("not_today", { code: "forgot" })]).value.topReason, null);
});

test("workDays: silent until enough done, then the best days", () => {
  assert.deepEqual(workDays(many(5, "done")).value.best, []);
  const w = workDays([...many(5, "done", { weekday: 0 }), ...many(3, "done", { weekday: 3 }), ...many(2, "done", { weekday: 4 })]);
  assert.deepEqual(w.value.best, [0, 3]);
  assert.equal(w.value.weekendShare, 0.5);
});

test("planningStyle and askPattern count codes only", () => {
  const p = planningStyle([...many(2, "plan_accept"), ev("plan_edit"), ev("plan_reject"), ...many(1, "question_answer"), ...many(3, "question_skip"), ev("plan_stop")]);
  assert.deepEqual(p.value, { accept: 2, edit: 1, reject: 1, answerRate: 0.25, stops: 1 });
  assert.equal(askPattern([...many(3, "chat_ask", { code: "stuck" }), ev("chat_ask", { code: "other" })]).value, "stuck");
  assert.equal(askPattern(many(2, "chat_ask", { code: "stuck" })).value, null);
});

test("behaviourLines: nothing until sure, then plain advice", () => {
  assert.deepEqual(behaviourLines([ev("done"), ev("plan_accept")]), []);
  const lines = behaviourLines([
    ...many(2, "done", { weekday: 6 }),
    ...many(4, "not_today", { code: "no_time" }),
    ...many(3, "plan_reject"),
    ...many(4, "question_skip"),
    ...many(3, "chat_ask", { code: "how_to" }),
  ]);
  assert.ok(lines.some((l) => l.startsWith("They finish about 3 in 10") && l.includes("small")));
  assert.ok(lines.some((l) => l.includes('"no time"')));
  assert.ok(lines.some((l) => l.includes("change or turn down plans")));
  assert.ok(lines.some((l) => l.includes("skip most planning questions")));
  assert.ok(lines.some((l) => l.includes("how to start")));
  // Never the student's words: lines are built only from codes.
  assert.ok(lines.every((l) => !l.includes("undefined")));
});
