// Run with `npm test`. Settings › AI Activity plain words (step 3B): what
// Tangent understood, the result chip, confidence dots, match strength, the
// question and answer, and the lenient query parser.
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

type Mod = typeof import("./ai-activity");

void (import("./ai-activity") as Promise<Mod>).then(({
  ACTIVITY_EMPTY_TEXT,
  CLEAR_CONFIRM_TEXT,
  RESULT_LABELS,
  TYPE_LABELS,
  answerText,
  attachUsage,
  confidenceLevel,
  filterActivity,
  formatCost,
  likePattern,
  matchStrength,
  paginate,
  parseActivityQuery,
  questionText,
  resultOf,
  understoodAs,
  whoDecided,
}) => {

const d = (route: string, intent: string | null, via = "router", outcome = "answered") => ({ route, intent, via, outcome });

test("understood: each request reads in plain words", () => {
  const label = (route: string, intent: string | null, via?: string) => TYPE_LABELS[understoodAs(d(route, intent, via))];
  assert.equal(label("plan", "new_plan"), "New plan");
  assert.equal(label("plan", "new_project"), "New project");
  assert.equal(label("plan", "add_to_plan"), "Add to a plan");
  assert.equal(label("task", "add_task"), "Single task");
  assert.equal(label("chat", "question"), "Question");
  assert.equal(label("fast", null, "fast"), "Quick capture (no AI)");
  assert.equal(label("clarify", "clarify"), "Asked you to choose");
  assert.equal(label("task", "delete_plan_tasks"), "Remove tasks");
  assert.equal(label("tangent", "tangent"), "Sent to Tangents");
  assert.equal(label("chat", null), "Question", "anything unknown reads as a question");
  // Quick capture wins even when an intent was guessed.
  assert.equal(label("task", "add_task", "fast"), "Quick capture (no AI)");
});

test("result chips follow the outcome, and removals read Removed", () => {
  const chip = (o: string, intent = "new_plan") => RESULT_LABELS[resultOf(d("plan", intent, "router", o))];
  assert.equal(chip("answered"), "Answered");
  assert.equal(chip("asked"), "Waiting for you");
  assert.equal(chip("drafted"), "Waiting for you");
  assert.equal(chip("confirmed"), "Added");
  assert.equal(chip("confirmed", "delete_task"), "Removed");
  assert.equal(chip("applied_instantly"), "Added instantly");
  assert.equal(chip("applied_instantly", "delete_plan_tasks"), "Removed");
  assert.equal(chip("discarded"), "Discarded");
  assert.equal(chip("undone"), "Undone");
  assert.equal(chip("failed"), "Failed");
  assert.equal(chip("something_new"), "Failed");
});

test("confidence dots and match strength use the documented bands", () => {
  assert.equal(confidenceLevel(0.9), "high");
  assert.equal(confidenceLevel(0.85), "high");
  assert.equal(confidenceLevel(0.7), "mid");
  assert.equal(confidenceLevel(0.3), "low");
  assert.equal(confidenceLevel(null), null);
  assert.equal(matchStrength(0.95), "strong");
  assert.equal(matchStrength(0.7), "possible");
  assert.equal(matchStrength(0.2), "weak");
});

test("who decided, the question and the answer read as sentences", () => {
  assert.equal(whoDecided("router"), "Tangent AI");
  assert.equal(whoDecided("fast"), "Quick capture rules (no AI)");
  assert.equal(whoDecided("answer"), "You, by answering");
  assert.equal(questionText({ kind: "match", candidates: 3 }), "Which plan do you mean? (3 choices)");
  assert.equal(questionText({ kind: "intent" }), "What did you mean?");
  assert.equal(questionText(null), null);
  assert.equal(answerText("asked", null), "Not answered yet.");
  assert.equal(answerText("confirmed", "SAT prep"), "You picked SAT prep.");
  assert.match(answerText("discarded", null), /nothing changed/);
});

test("the spec's exact copy", () => {
  assert.equal(CLEAR_CONFIRM_TEXT, "This clears the log. Your calendar stays the same.");
  assert.equal(ACTIVITY_EMPTY_TEXT, "Nothing yet. When you ask Tangent AI to plan or change things, you'll see what it did here.");
});

test("the query parser falls back on anything it doesn't know", () => {
  const q = parseActivityQuery(new URLSearchParams("page=-4&result=nope&type=remove&days=12&q=  essay  "));
  assert.equal(q.page, 1);
  assert.equal(q.result, null);
  assert.equal(q.type, "remove");
  assert.equal(q.days, 30);
  assert.equal(q.q, "essay");
  assert.equal(q.focus, null);
  const f = parseActivityQuery(new URLSearchParams("days=7&focus=cs:00000000-0000-4000-8000-000000000001"));
  assert.equal(f.days, 7);
  assert.deepEqual(f.focus, { by: "cs", id: "00000000-0000-4000-8000-000000000001" });
  assert.equal(parseActivityQuery(new URLSearchParams("focus=cs:'; drop table")).focus, null);
});

test("search terms are literal inside ILIKE", () => {
  assert.equal(likePattern("100%_done\\"), "%100\\%\\_done\\\\%");
});

test("filters and pages", () => {
  const rows = [d("plan", "new_plan", "router", "confirmed"), d("task", "delete_task", "router", "confirmed"), d("chat", "question")];
  assert.equal(filterActivity(rows, { result: "removed", type: null }).length, 1);
  assert.equal(filterActivity(rows, { result: null, type: "question" }).length, 1);
  const p = paginate(Array.from({ length: 60 }, (_, i) => i), 9);
  assert.equal(p.page, 3);
  assert.equal(p.pages, 3);
  assert.deepEqual(p.items, Array.from({ length: 10 }, (_, i) => 50 + i));
});

test("usage goes to the decision written just after it, and cost reads simply", () => {
  const ds = [
    { id: "a", createdAt: "2026-10-11T10:00:00.000Z" },
    { id: "b", createdAt: "2026-10-11T10:10:00.000Z" },
  ];
  const line = (at: string, model: string) => ({ createdAt: at, model, inputTokens: 100, outputTokens: 10, costUsd: 0.001 });
  const m = attachUsage(ds, [line("2026-10-11T09:59:30.000Z", "x"), line("2026-10-11T10:09:50.000Z", "y"), line("2026-10-11T10:09:55.000Z", "y"), line("2026-10-11T09:00:00.000Z", "z")]);
  assert.deepEqual(m.get("a")?.models, ["x"]);
  assert.equal(m.get("b")?.inputTokens, 200);
  assert.deepEqual(m.get("b")?.models, ["y"]);
  assert.equal(Array.from(m.values()).some((u) => u.models.includes("z")), false, "too early to belong to anything");
  assert.equal(formatCost(0), "$0");
  assert.equal(formatCost(0.004), "<$0.01");
  assert.equal(formatCost(1.234), "$1.23");
});
});
