// Run with `npm test`. Same resolve hook as ics.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { GrillItem } from "./grill-queue";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

void (import("./grill-queue") as Promise<typeof import("./grill-queue")>).then(({ IN_A_ROW, PLAN_BUDGET, SESSION_BUDGET, TODAY_BUDGET, changesPlan, factFromAnswer, isStale, kindOfQuestion, knownKinds, pickGrillQuestions, rankQueue, todayQueue }) => {
const item = (over: Partial<GrillItem>): GrillItem => ({
  id: "q",
  projectId: "p",
  question: "When?",
  kind: "deadline",
  choices: [],
  priority: 10,
  status: "open",
  answer: null,
  createdAt: "2026-11-01T10:00:00Z",
  answeredAt: null,
  ...over,
});
const day = (iso: string) => iso.slice(0, 10);

test("the budgets are what the brief says", () => {
  assert.deepEqual([PLAN_BUDGET, TODAY_BUDGET, SESSION_BUDGET, IN_A_ROW], [3, 3, 5, 3]);
});

test("a plan gets at most three questions, biggest plan impact first", () => {
  const picked = pickGrillQuestions({ title: "AP Chem final", facts: [] });
  assert.deepEqual(picked.map((q) => q.kind), ["deadline", "hours", "level"]);
  assert.ok(picked[0].priority > picked[1].priority && picked[1].priority > picked[2].priority);
  assert.ok(picked[0].question.includes("AP Chem final"));
});

test("questions asked before the preview use up the budget", () => {
  assert.equal(pickGrillQuestions({ title: "Chem", facts: [], askedJustNow: 2 }).length, 1);
  assert.equal(pickGrillQuestions({ title: "Chem", facts: [], askedJustNow: 3 }).length, 0);
  assert.equal(pickGrillQuestions({ title: "Chem", facts: [], askedJustNow: 9 }).length, 0);
});

test("never asks what the student just said", () => {
  const picked = pickGrillQuestions({ title: "SAT", facts: [], said: "Get ready for the SAT by March, I can do 5 hours a week" });
  assert.deepEqual(picked.map((q) => q.kind), ["level", "hardest", "constraints"]);
});

test("never asks what a fact about this project already answers", () => {
  const facts = ["AP Chem final, needs to be done: In 2 weeks", "AP Chem final, starting from: Know the basics"];
  assert.deepEqual(pickGrillQuestions({ title: "AP Chem final", facts }).map((q) => q.kind), ["hours", "hardest", "constraints"]);
});

test("a fact about another project doesn't count", () => {
  const known = knownKinds(["Robotics club, hours a week: 3–5 hrs"], "AP Chem final");
  assert.equal(known.has("hours"), false);
});

test("fixed constraints belong to the student, whichever project", () => {
  assert.equal(knownKinds(["Robotics club, plan around: Weekends are out"], "AP Chem final").has("constraints"), true);
});

test("never asks a project the same kind twice, skipped included", () => {
  const picked = pickGrillQuestions({ title: "Chem", facts: [], asked: ["deadline", "hours"] });
  assert.deepEqual(picked.map((q) => q.kind), ["level", "hardest", "constraints"]);
});

test("clarify questions map onto kinds", () => {
  assert.equal(kindOfQuestion("When's the exam?"), "deadline");
  assert.equal(kindOfQuestion("How many hours a week can you give this?"), "hours");
  assert.equal(kindOfQuestion("What have you already done?"), "level");
  assert.equal(kindOfQuestion("What's your favourite colour?"), null);
});

test("the queue runs by priority, then oldest first, open only", () => {
  const ranked = rankQueue([
    item({ id: "low", priority: 10 }),
    item({ id: "newer", priority: 50, createdAt: "2026-11-02T10:00:00Z" }),
    item({ id: "older", priority: 50 }),
    item({ id: "done", priority: 99, status: "answered" }),
  ]);
  assert.deepEqual(ranked.map((i) => i.id), ["older", "newer", "low"]);
});

test("Today shows three a day, counting what was already dealt with", () => {
  const open = ["a", "b", "c", "d"].map((id) => item({ id }));
  assert.equal(todayQueue(open, "2026-11-03", day).length, 3);
  const handled = [item({ id: "x", status: "answered", answeredAt: "2026-11-03T09:00:00Z" }), item({ id: "y", status: "skipped", answeredAt: "2026-11-03T09:01:00Z" })];
  assert.equal(todayQueue([...open, ...handled], "2026-11-03", day).length, 1);
  assert.equal(todayQueue([...open, ...handled], "2026-11-04", day).length, 3);
});

test("only answers that move the plan offer a re-plan", () => {
  assert.equal(changesPlan("deadline"), true);
  assert.equal(changesPlan("hours"), true);
  assert.equal(changesPlan("constraints"), true);
  assert.equal(changesPlan("hardest"), false);
  assert.equal(changesPlan("general"), false);
});

test("a saved answer names its project, and de-dups the next time", () => {
  const fact = factFromAnswer({ question: "How many hours a week can you give Chem?", kind: "hours" }, "3–5 hrs", "AP Chem final");
  assert.equal(fact, "AP Chem final, hours a week: 3–5 hrs");
  assert.equal(knownKinds([fact], "AP Chem final").has("hours"), true);
});

test("each kind's answer de-dups itself", () => {
  const title = "AP Chem final";
  const answers: [string, string][] = [["deadline", "End of term"], ["hours", "1–2 hrs"], ["level", "Starting fresh"], ["hardest", "Finding time"], ["constraints", "Nothing fixed"]];
  for (const [kind, answer] of answers) {
    const fact = factFromAnswer({ question: "Q?", kind }, answer, title);
    assert.ok(knownKinds([fact], title).has(kind as "deadline"), kind);
  }
});

test("unanswered questions go stale after a month", () => {
  const now = new Date("2026-12-15T00:00:00Z");
  assert.equal(isStale(item({}), now), true);
  assert.equal(isStale(item({ createdAt: "2026-12-01T00:00:00Z" }), now), false);
  assert.equal(isStale(item({ status: "answered" }), now), false);
});
});
