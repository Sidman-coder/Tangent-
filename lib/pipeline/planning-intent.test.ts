// Run with `npm test`. Round 4 §3.1: planning requests plan, never become a
// task. Same resolve hook as lib/ai/router-quick.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../../${specifier.slice(2)}`, import.meta.url).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

type PI = typeof import("./planning-intent");
type Intent = typeof import("./intent");
type Router = typeof import("../ai/router");

void Promise.all([import("./planning-intent") as Promise<PI>, import("./intent") as Promise<Intent>, import("../ai/router") as Promise<Router>]).then(
  ([{ isPlanningRequest, planningGoal }, { classifyIntent }, { quickCapture }]) => {
    const tz = "America/New_York";
    const at = new Date("2026-11-08T16:00:00-05:00");
    const PLANNING = [
      "Break down plan: get 10k followers on Instagram",
      "break down my history project",
      "make a plan for the chem final",
      "make me a 2 week workout plan",
      "make a path for learning guitar",
      "plan out my college essays",
      "help me get a 1400 on the SAT",
      "help me grow my YouTube channel",
      "steps to start a podcast",
      "what are the steps to get my license",
      "how do I get better at chess",
      "how can I get 10k followers?",
      "um can you help me prepare for the robotics competition",
    ];
    const NOT_PLANNING = [
      "dentist tomorrow at 3pm",
      "read english chapter 6",
      "help me move my dentist appointment to friday",
      "what's due this week",
      "finished my chem lab",
      "how long is the essay supposed to be",
      "my plan is going well",
    ];

    test("isPlanningRequest: planning words plan", () => {
      for (const t of PLANNING) assert.ok(isPlanningRequest(t), t);
      for (const t of NOT_PLANNING) assert.ok(!isPlanningRequest(t), t);
    });

    test("planningGoal: the goal without the lead", () => {
      assert.equal(planningGoal("Break down plan: get 10k followers on Instagram"), "Get 10k followers on Instagram");
      assert.equal(planningGoal("make a plan for the chem final."), "The chem final");
      assert.equal(planningGoal("help me get a 1400 on the SAT"), "Get a 1400 on the SAT");
      assert.equal(planningGoal("how do I get better at chess?"), "Get better at chess");
      assert.equal(planningGoal("steps to start a podcast"), "Start a podcast");
    });

    test("quick capture never saves a planning request as a task", () => {
      for (const t of PLANNING) assert.equal(quickCapture(t, tz, at), null, t);
      assert.equal(quickCapture("read english chapter 6", tz, at)?.title, "Read english chapter 6");
    });

    test("a router that says add_task or question is overruled: it plans, with questions", async () => {
      for (const wrong of ["add_task", "question", "clarify"] as const) {
        const caller = async () => ({ intent: wrong, confidence: 0.9, plan_mention: null, task_mention: null, clean_title: "Break down plan get 10k followers", needs_questions: false, reason: "test" });
        const u = await classifyIntent("Break down plan: get 10k followers on Instagram", { flag: true, tz, today: "2026-11-08", planTitles: [], caller, at });
        assert.equal(u.intent, "new_plan", wrong);
        assert.equal(u.route, "draft", wrong);
        assert.equal(u.cleanTitle, null, wrong);
        assert.equal(u.needsQuestions, true, wrong);
      }
    });

    test("the rules fallback plans too, and leaves real edits alone", async () => {
      const caller = async () => null;
      const u = await classifyIntent("help me grow my YouTube channel", { flag: true, tz, today: "2026-11-08", planTitles: [], caller, at });
      assert.equal(u.intent, "new_plan");
      assert.equal(u.route, "draft");
      const keep = async () => ({ intent: "add_to_plan", confidence: 0.9, plan_mention: "SAT plan", task_mention: null, clean_title: null, needs_questions: false, reason: "t" });
      const v = await classifyIntent("help me add a session to my SAT plan", { flag: true, tz, today: "2026-11-08", planTitles: ["SAT plan"], caller: keep, at });
      assert.equal(v.intent, "add_to_plan");
    });
  },
);
