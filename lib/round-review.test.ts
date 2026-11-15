// Run with `npm test`. Round 5A Phase 5: the end-of-round review reads data
// (dates, codes), asks 3 to 5 questions, and moves round N+1 to its start.
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

void (import("./round-review") as Promise<typeof import("./round-review")>).then(
  ({ roundFacts, factLines, readQuestions, fallbackQuestions, answerFacts, startDate, shiftRound, withRoundOp, START_QUESTION_ID }) => {
    const round = { n: 1, startedOn: "2026-11-02" };
    const steps = [
      { id: "a", title: "Two-pointer drills", date: "2026-11-02", completed: true, completedAt: "2026-11-02T20:00:00Z" },
      { id: "b", title: "Binary search set", date: "2026-11-04", completed: true, completedAt: "2026-11-06T20:00:00Z" },
      { id: "c", title: "Graph BFS problems", date: "2026-11-06", completed: true, completedAt: "2026-11-09T19:00:00Z" },
      { id: "d", title: "Mock contest", date: "2026-11-08", completed: false },
      { id: "e", title: "Review mistakes", date: "2026-11-15", completed: false },
    ];
    const codes = [
      { taskId: "b", kind: "rescheduled", code: "moved" },
      { taskId: "b", kind: "rescheduled", code: "moved" },
      { taskId: "c", kind: "rescheduled", code: "moved" },
      { taskId: "a", kind: "check_in", code: "nailed" },
      { taskId: "b", kind: "check_in", code: "struggled" },
      { taskId: "b", kind: "check_in", code: "longer" },
      { taskId: "c", kind: "check_in", code: "longer" },
      { taskId: "d", kind: "not_today", code: "too_tired" },
      { taskId: "d", kind: "skipped", code: "skipped" },
    ];

    test("roundFacts: counts done, late, missed, moved and check-ins from the data", () => {
      const f = roundFacts(steps, codes, round, "2026-11-10");
      assert.equal(f.round, 1);
      assert.equal(f.next, 2);
      assert.equal(f.total, 5);
      assert.equal(f.done, 3);
      assert.deepEqual(f.late, [{ title: "Graph BFS problems", days: 3 }, { title: "Binary search set", days: 2 }]);
      assert.deepEqual(f.missed, ["Mock contest"]);
      assert.equal(f.moved, 2, "a step moved twice counts once");
      assert.equal(f.skipped, 1);
      assert.deepEqual(f.feel, { nailed: 1, okay: 0, struggled: 1 });
      assert.deepEqual(f.time, { faster: 0, about: 0, longer: 2 });
      assert.deepEqual(f.notToday, { too_tired: 1 });
      assert.equal(f.daysTaken, 8);
    });

    test("factLines: plain lines with titles and counts only", () => {
      const lines = factLines(roundFacts(steps, codes, round, "2026-11-10"));
      assert.equal(lines[0], "Finished 3 of 5 steps in round 1.");
      assert.ok(lines.some((l) => l.startsWith("2 finished late") && l.includes('"Graph BFS problems" (3 days late)')));
      assert.ok(lines.some((l) => l === '2 steps were moved to another day.'));
      assert.ok(lines.some((l) => l.includes("2 took longer")));
      assert.ok(lines.includes("1 step was skipped."));
    });

    test("fallbackQuestions: built from what happened, 3 of them", () => {
      const f = roundFacts(steps, codes, round, "2026-11-10");
      const qs = fallbackQuestions(f);
      assert.equal(qs.length, 3);
      assert.match(qs[0].text, /2 steps finished late/);
      assert.match(qs[1].text, /took longer/);
      // A round that went to plan asks about pace instead.
      const clean = roundFacts(steps.map((s) => ({ ...s, completed: true, completedAt: `${s.date}T18:00:00Z` })), [], round, "2026-11-20");
      assert.match(fallbackQuestions(clean)[0].text, /finished 5 of 5/);
    });

    test("readQuestions: 2-4 checked AI questions, then the start question last", () => {
      const f = roundFacts(steps, codes, round, "2026-11-10");
      const raw = {
        questions: [
          { text: "Binary search took two extra days. Was it the topic or the timing?", chips: ["The topic", "The timing", "Both"] },
          { text: "No chips here", chips: ["one"] },
          { text: "When should round 2 start?", chips: ["Now", "Later"] },
          { text: "Did the mock contest feel too big?", chips: ["Too big", "Fine", "Fine"] },
        ],
      };
      const qs = readQuestions(raw, f);
      assert.equal(qs.length, 3);
      assert.deepEqual(qs.map((q) => q.id), ["q1", "q2", START_QUESTION_ID]);
      assert.deepEqual(qs[1].chips, ["Too big", "Fine"], "duplicate chips dropped");
      assert.equal(qs[2].text, "When should round 2 start?");
      assert.deepEqual(qs[2].chips, ["Start now", "Push 1 week", "Pick a date"]);
    });

    test("readQuestions: falls back to the data questions when the AI gives too few", () => {
      const f = roundFacts(steps, codes, round, "2026-11-10");
      const qs = readQuestions({ questions: [{ text: "Just one", chips: ["a", "b"] }] }, f);
      assert.equal(qs.length, 4);
      assert.equal(qs.at(-1)?.id, START_QUESTION_ID);
      assert.equal(readQuestions(null, f).length, 4);
    });

    test("answerFacts: keeps plain answers, drops sensitive ones and the start answer", () => {
      const facts = answerFacts(
        [
          { questionId: "q1", question: "Was the timing too tight?", chip: "Too tight" },
          { questionId: "q2", question: "Anything else?", text: "My therapist says I need breaks" },
          { questionId: START_QUESTION_ID, question: "When should round 2 start?", chip: "Push 1 week" },
        ],
        "Competitive programming",
        1,
      );
      assert.equal(facts.length, 1);
      assert.match(facts[0], /Competitive programming round 1/);
      assert.match(facts[0], /Too tight/);
    });

    test("startDate: now, push a week, or a picked date (never in the past)", () => {
      assert.equal(startDate({ kind: "now" }, "2026-11-14"), "2026-11-14");
      assert.equal(startDate({ kind: "push" }, "2026-11-14"), "2026-11-21");
      assert.equal(startDate({ kind: "date", date: "2026-11-18" }, "2026-11-14"), "2026-11-18");
      assert.equal(startDate({ kind: "date", date: "2026-11-01" }, "2026-11-14"), "2026-11-14");
    });

    test("withRoundOp + shiftRound: the round line moves with the steps", () => {
      const ops = [
        { op: "add_task" as const, title: "DP basics", date: "2026-11-15", plan_id: "p1" },
        { op: "add_task" as const, title: "DP set", date: "2026-11-17", plan_id: "p1" },
      ];
      const withLine = withRoundOp(ops, "p1", "Get to Codeforces 1400\nRound — 1 · started 2026-11-02", { n: 2, startedOn: "2026-11-15" });
      assert.ok(withLine);
      assert.equal(withLine.length, 3);
      const shifted = shiftRound(withLine, "2026-11-22");
      const dates = shifted.flatMap((o) => (o.op === "add_task" ? [o.date] : []));
      assert.deepEqual(dates, ["2026-11-22", "2026-11-24"]);
      const up = shifted.find((o) => o.op === "update_plan");
      assert.ok(up && up.op === "update_plan");
      assert.equal(up.notes, "Get to Codeforces 1400\nRound — 2 · started 2026-11-22");
      // A second call replaces the line op instead of adding another.
      assert.equal(withRoundOp(withLine, "p1", "x", { n: 2, startedOn: "2026-11-15" })?.filter((o) => o.op === "update_plan").length, 1);
      // Too long for an op: null, the caller advances after confirm.
      assert.equal(withRoundOp(ops, "p1", "x".repeat(2100), { n: 2, startedOn: "2026-11-15" }), null);
    });
  },
);
