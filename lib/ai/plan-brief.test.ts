// Run with `npm test`. Master fix Phase 3: the adaptive grill's briefs, slot
// filling from context, question caps and Just-do-it defaults.
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

type Mod = typeof import("./plan-brief");

void (import("./plan-brief.ts" as string) as Promise<Mod>).then(
  ({ goalType, readBrief, briefQuestions, briefAssumptions, briefNotes, splitAnswers, MAX_QUESTIONS, SAFETY_ASSUMPTION, BRIEFS }) => {
    const brief = (text: string, ctx: Parameters<typeof readBrief>[1] = {}) => {
      const b = readBrief(text, ctx);
      assert.ok(b, `a brief for: ${text}`);
      return b;
    };
    const ids = (text: string, ctx: Parameters<typeof readBrief>[1] = {}) => briefQuestions(brief(text, ctx)).map((q) => q.id);

    test("each kind of goal is told apart, and a plain capture is never grilled", () => {
      assert.equal(goalType("help me study for the SAT"), "exam");
      assert.equal(goalType("I need to prep for my AP Bio exam"), "exam");
      assert.equal(goalType("help me get ready for ISEF"), "competition");
      assert.equal(goalType("I'm working on a science fair project"), "competition");
      assert.equal(goalType("I want to get better at chess"), "skill");
      assert.equal(goalType("I want to be like Mike Tyson"), "skill");
      assert.equal(goalType("fight Mike Tyson in 2 weeks"), "skill", "the silly match-up is a skill aspiration");
      assert.equal(goalType("I have a fight with my brother tomorrow"), null);
      assert.equal(goalType("I want to build a habit of reading every day"), "habit");
      assert.equal(goalType("add chem test friday"), "single");
      assert.equal(goalType("debate tournament on saturday"), "single");
      assert.equal(goalType("organize my week"), null, "not a known kind: the model decides, as before");
    });

    test("slots fill from the request, so a specific ask gets no questions", () => {
      const b = brief("Help me study for the SAT on Dec 6, aiming for 1500, math is my weak spot, 5 hours a week after school");
      assert.deepEqual(b.missing.map((s) => s.id), []);
      assert.equal(b.filled.target, "1500");
      assert.equal(b.filled.subjects.toLowerCase(), "math");
      assert.deepEqual(briefQuestions(b), []);
    });

    test("no question when the student context already answers it", () => {
      const context = [
        "DAILY CAPACITY (their own answer): about 2 hr of work on school nights, 3 hr 12 min on weekends.",
        "COMING UP FOR SCHOOL:\n- 2026-11-03: AP Chem unit test",
        "GOALS THEY'RE WORKING TOWARD (Paths):\n- SAT: 1450 math (by 2026-12-06), 4 hrs/week",
      ].join("\n\n");
      // The date, target and hours come from the Paths line; subjects from it too.
      const sat = brief("help me prep for the SAT", { studentContext: context, capacityKnown: true });
      assert.equal(sat.filled.date, "2026-12-06");
      assert.equal(sat.filled.hours, "4 hrs/week");
      assert.deepEqual(briefQuestions(sat), []);
      // A Canvas test date is used for its own exam, and capacity covers hours.
      const chem = brief("help me study for my AP Chem unit test", { studentContext: context, capacityKnown: true });
      assert.equal(chem.filled.date, "2026-11-03");
      assert.equal(chem.filled.hours, "your usual capacity");
      assert.deepEqual(briefQuestions(chem).map((q) => q.id), ["brief-target"]);
      // The chat so far counts as well.
      assert.deepEqual(ids("help me get better at guitar", { chat: "I'm a total beginner and can practice 3 times a week" }), ["brief-timeframe", "brief-access"]);
    });

    test("only missing required slots are asked, most impact first, within each kind's cap", () => {
      assert.deepEqual(ids("help me study for the SAT"), ["brief-date", "brief-subjects", "brief-target"]);
      assert.deepEqual(ids("help me get ready for ISEF"), ["brief-deadline", "brief-stage", "brief-category"]);
      assert.deepEqual(ids("I want to get better at chess"), ["brief-timeframe", "brief-level"]);
      assert.deepEqual(ids("I want to start a habit of journaling every day"), ["brief-time"]);
      for (const [type, max] of Object.entries(MAX_QUESTIONS)) {
        const required = BRIEFS[type as keyof typeof BRIEFS].filter((s) => s.required).length;
        assert.ok(max <= 3, `${type}: at most 3 questions`);
        assert.ok(required >= Math.min(max, required), type);
      }
      assert.ok(MAX_QUESTIONS.skill <= 2 && MAX_QUESTIONS.habit <= 2, "simple asks get 0–2");
      assert.equal(MAX_QUESTIONS.single, 0);
      assert.equal(readBrief("add chem test friday")?.type, "single");
      assert.deepEqual(briefQuestions(readBrief("add chem test friday")!), []);
    });

    test("the Mike Tyson case: one light question, then a safe plan", () => {
      const b = brief("I want to be like Mike Tyson");
      assert.equal(b.aspiration, true);
      const qs = briefQuestions(b);
      assert.equal(qs.length, 1);
      assert.equal(qs[0].id, "brief-level");
      assert.ok(qs[0].options.includes("Total beginner"));
      assert.ok(qs[0].assume, "the card shows what Tangent assumes if it's skipped");
      // After the answer (or Just do it) the defaults are safe ones.
      const answered = brief("I want to be like Mike Tyson\n\nMy answers to your questions:\n- Where are you starting, and how good do you want to get? Total beginner");
      assert.equal(answered.filled.level, "Total beginner");
      const assumed = briefAssumptions(answered);
      assert.ok(assumed.includes(SAFETY_ASSUMPTION));
      assert.ok(assumed.includes("3 sessions a week"));
      assert.ok(assumed.includes("No coach or special gear needed to start"));
    });

    test("Just do it: every unanswered slot's default appears as an assumption", () => {
      const b = brief("help me study for the SAT");
      const assumed = briefAssumptions(b);
      assert.deepEqual(assumed, [
        "Every section, weakest first once you tell me",
        "A solid improvement: practice first, then timed review",
        "About 3–4 hours a week, fitted to your usual capacity",
        "At your open times after school",
      ]);
      assert.ok(!assumed.some((a) => /about a week of prep/i.test(a)), "the drafter states the date range itself");
    });

    test("answers fill their slots, Other/not sure stay defaults, and the brief is saved as project notes", () => {
      const text = [
        "help me get ready for ISEF",
        "",
        "My answers to your questions:",
        "- When is the deadline or event? In about a month",
        "- Where are you with it right now? Researching",
        "- What category or field is it in? Not sure",
        "- Do you have a mentor or teacher helping? On my own",
        "",
        "(This request is inside the student's project \"ISEF\".)",
      ].join("\n");
      const split = splitAnswers(text);
      assert.equal(split.answers.size, 4);
      assert.ok(split.request.includes("inside the student's project"), "a project note after the answers is kept");
      const b = brief(text);
      assert.equal(b.filled.deadline, "In about a month");
      assert.equal(b.filled.stage, "Researching");
      assert.equal(b.filled.mentor, "On my own");
      assert.deepEqual(b.missing.map((s) => s.id), ["category", "hours", "milestones"]);
      const notes = briefNotes(b);
      assert.match(notes, /^Brief — Deadline: In about a month · Stage: Researching · Mentor: On my own/);
      assert.match(notes, /Assumed — General steps that fit any category/);
    });
  }
);
