// Run with `npm test`. Same resolve hook as ics.test.ts.
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

type Slots = typeof import("./slots");
type Infer = typeof import("./infer");
type Flow = typeof import("./flow");

void Promise.all([import("./slots") as Promise<Slots>, import("./infer") as Promise<Infer>, import("./flow") as Promise<Flow>]).then(
  ([slots, infer, flow]) => {
    const { computeSufficiency, SLOT_WEIGHTS, ENOUGH, slotValue } = slots;
    const { inferSlotsFromText } = infer;
    const { EMPTY_FLOW, nextStep, answerSlot, skipSlot, slotToFact, rankSlotQueue, answerChangesPlan, preferredWindows, parseSlotAnswer, CHECK_IN_AFTER } = flow;
    const TODAY = "2026-11-05";
    const now = new Date("2026-11-05T12:00:00Z");

    test("weights add up to 1", () => {
      const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
      assert.equal(Math.round(total * 100) / 100, 1);
    });

    test("infers outcome and deadline from a plan request", () => {
      const got = inferSlotsFromText("help me get ready for the SAT in a month", TODAY);
      assert.equal(got.deadline?.value, "in a month");
      assert.match(String(got.outcome?.value), /get ready for the SAT/);
      assert.equal(got.deadline?.source, "inferred");
      assert.equal(got.hoursPerWeek, undefined);
    });

    test("infers hours, level, constraints and work times", () => {
      const got = inferSlotsFromText("learn guitar from scratch, 30 minutes a day, in the evenings, except Sundays", TODAY);
      assert.equal(got.hoursPerWeek?.value, 2.5);
      assert.equal(got.currentLevel?.value, "Brand new");
      assert.match(String(got.constraints?.value), /Sundays/i);
      assert.deepEqual(got.bestTimeForThis?.value, ["Evenings"]);
      assert.equal(inferSlotsFromText("study 4 hours a week", TODAY).hoursPerWeek?.value, 4);
    });

    test("a plain errand infers nothing worth asking about", () => {
      assert.deepEqual(Object.keys(inferSlotsFromText("Dentist", TODAY)), []);
    });

    test("SAT worked example: two questions, then a draft", () => {
      const text = "help me get ready for the SAT in a month";
      let state = { ...EMPTY_FLOW, answered: inferSlotsFromText(text, TODAY) };
      let global = {};
      const suff = () => computeSufficiency(state.answered, global, [], text);
      assert.equal(suff().score, 0.4);

      let step = nextStep(state, suff(), global);
      assert.equal(step.type, "ask");
      assert.equal(step.type === "ask" && step.slot, "hoursPerWeek");
      state = answerSlot(state, "hoursPerWeek", "3–5", now);
      assert.equal(state.answered.hoursPerWeek?.value, 4);
      assert.equal(suff().score, 0.6);

      step = nextStep(state, suff(), global);
      assert.equal(step.type === "ask" && step.slot, "preferredWorkTimes");
      state = answerSlot(state, "preferredWorkTimes", "Evenings", now);
      global = { preferredWorkTimes: parseSlotAnswer("preferredWorkTimes", "Evenings", now) };
      assert.equal(suff().score, ENOUGH);

      step = nextStep(state, suff(), global);
      assert.equal(step.type, "draft");
      assert.deepEqual(step.type === "draft" && step.assumptions, []);
    });

    test("skipping deadline and hours applies defaults and still finishes", () => {
      const text = "make a plan for my robotics project";
      let state = { ...EMPTY_FLOW };
      const global = { preferredWorkTimes: slotValue(["Evenings"], "known", now) };
      const steps: string[] = [];
      for (let i = 0; i < 12; i++) {
        const step = nextStep(state, computeSufficiency(state.answered, global, [], text), global);
        if (step.type === "check_in") {
          steps.push("check_in");
          state = { ...state, inARow: 0 }; // Keep going
          continue;
        }
        if (step.type !== "ask") {
          steps.push(step.type);
          if (step.type === "draft") {
            assert.deepEqual(step.assumptions, ["Finish in about 2 weeks", "About 3 hours a week"]);
          }
          break;
        }
        steps.push(step.slot);
        state = skipSlot(state, step.slot, now);
      }
      assert.deepEqual(steps.slice(0, 2), ["deadline", "hoursPerWeek"]);
      assert.equal(steps.at(-1), "draft");
      assert.equal(state.answered.deadline?.source, "default");
    });

    test("checks in after 5 in a row, and Plan now drafts", () => {
      const state = { ...EMPTY_FLOW, inARow: CHECK_IN_AFTER, answered: { deadline: slotValue("2 weeks", "answer", now) } };
      const s = computeSufficiency(state.answered, {}, [], "plan my essay");
      assert.equal(nextStep(state, s, {}).type, "check_in");
      assert.equal(nextStep({ ...state, stopped: true }, s, {}).type, "draft");
    });

    test("known facts count toward sufficiency", () => {
      const s = computeSufficiency({}, {}, ["Can give 5 hours a week for robotics"], "robotics build", "Robotics build");
      assert.ok(!s.missing.includes("hoursPerWeek"));
      assert.equal(s.score, 0.2);
    });

    test("facts, queue ranking, re-plan and work windows", () => {
      assert.equal(slotToFact("hoursPerWeek", slotValue(4, "answer", now), "SAT prep"), "Can give 4 hrs a week for SAT prep");
      const ranked = rankSlotQueue([
        { projectId: "a", title: "A", score: 0.8, missing: ["deadline"] },
        { projectId: "b", title: "B", score: 0.2, missing: ["hardestPart", "deadline"] },
      ]);
      assert.deepEqual(ranked.map((r) => `${r.projectId}:${r.slot}`), ["b:deadline", "a:deadline", "b:hardestPart"]);
      assert.equal(answerChangesPlan("deadline", slotValue("2 weeks", "default", now), slotValue("1 month", "answer", now)), true);
      assert.equal(answerChangesPlan("hardestPart", undefined, slotValue("Starting", "answer", now)), false);
      assert.deepEqual(preferredWindows(slotValue(["Evenings", "Weekends"], "answer", now)), [{ start: 1140, end: 1320 }]);
      assert.equal(preferredWindows(slotValue(["Weekends"], "answer", now)), undefined);
    });
  },
);
