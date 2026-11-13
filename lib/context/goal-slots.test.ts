// Run with `npm test`. Same resolve hook as context.test.ts.
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

type GoalSlots = typeof import("./goal-slots");

void (import("./goal-slots") as Promise<GoalSlots>).then((g) => {
  const { goalTypeOf, inferExtraSlots, nextQuestions, questionCard, GOAL_SLOTS, MAX_TOTAL, MAX_PER_TURN, isStudentSlot, isQuestionSlot, SLOT_FACT_LABEL } = g;
  const state = (type: ReturnType<typeof goalTypeOf>, filled: string[] = [], over: Partial<Parameters<typeof nextQuestions>[0]> = {}) => ({
    type,
    filled: new Set(filled),
    skipped: new Set<string>(),
    asked: 0,
    stopped: false,
    ...over,
  });

  test("goalTypeOf picks the goal's kind", () => {
    assert.equal(goalTypeOf("Grow my Instagram"), "creator");
    assert.equal(goalTypeOf("get more tiktok followers"), "creator");
    assert.equal(goalTypeOf("SAT prep"), "exam");
    assert.equal(goalTypeOf("Study for the AP Bio exam"), "exam");
    assert.equal(goalTypeOf("Start a robotics club"), "club");
    assert.equal(goalTypeOf("Common App personal statement"), "essay");
    assert.equal(goalTypeOf("Learn guitar"), "general");
  });

  test("the Instagram goal asks about followers, niche and time per week", () => {
    const type = goalTypeOf("I want to grow my Instagram");
    const filled = Object.keys(inferExtraSlots("I want to grow my Instagram"));
    assert.ok(filled.includes("platform"), "platform is read from the words");
    const asked: string[] = [];
    let s = state(type, filled);
    for (let i = 0; i < 5; i++) {
      const turn = nextQuestions(s);
      if (turn.type === "draft") break;
      asked.push(...turn.slots);
      s = { ...s, filled: new Set([...Array.from(s.filled), ...turn.slots]), asked: s.asked + turn.slots.length };
    }
    for (const slot of ["followers", "niche", "hoursPerWeek"]) assert.ok(asked.includes(slot), `asks ${slot}`);
    assert.ok(!asked.includes("platform"), "never asks what it was told");
  });

  test("1–3 a turn, 5 at most, never a loop", () => {
    for (const type of ["general", "exam", "creator", "club", "essay"] as const) {
      let s = state(type);
      let turns = 0;
      while (turns < 10) {
        const turn = nextQuestions(s);
        if (turn.type === "draft") break;
        assert.ok(turn.slots.length >= 1 && turn.slots.length <= MAX_PER_TURN);
        s = { ...s, skipped: new Set([...Array.from(s.skipped), ...turn.slots]), asked: s.asked + turn.slots.length };
        turns++;
      }
      assert.ok(turns <= 3, `${type} took ${turns} turns`);
      assert.ok(s.asked <= MAX_TOTAL, `${type} asked ${s.asked}`);
      assert.ok(s.asked >= 2, `${type} asked at least two`);
    }
  });

  test("enough once the must-haves are filled", () => {
    const turn = nextQuestions(state("general", GOAL_SLOTS.general.must));
    assert.equal(turn.type, "draft");
    assert.equal(turn.type === "draft" && turn.enough, true);
  });

  test("stop drafts right away", () => {
    const turn = nextQuestions(state("exam", [], { stopped: true }));
    assert.equal(turn.type, "draft");
    assert.equal(turn.type === "draft" && turn.enough, false);
  });

  test("the first turn is padded to two questions", () => {
    const turn = nextQuestions(state("general", ["outcome", "deadline"]));
    assert.equal(turn.type, "ask");
    assert.equal(turn.type === "ask" && turn.slots.length, 2);
  });

  test("reads the words first", () => {
    const got = inferExtraSlots("My TikTok has 2.5k followers, my account is about skateboarding. I post twice a week.");
    assert.equal(got.platform?.value, "TikTok");
    assert.equal(got.followers?.value, "2.5k");
    assert.equal(got.niche?.value, "skateboarding");
    assert.equal(got.postingFrequency?.value, "twice a week");
    const essay = inferExtraSlots("Common app essay, I have a rough draft");
    assert.equal(essay.drafts?.value, "rough draft");
    const exam = inferExtraSlots("SAT in March, I struggle with geometry");
    assert.equal(exam.weakTopics?.value, "geometry");
  });

  test("every slot has a card and a label; student slots are shared", () => {
    for (const type of ["general", "exam", "creator", "club", "essay"] as const) {
      for (const slot of [...GOAL_SLOTS[type].must, ...GOAL_SLOTS[type].nice]) {
        assert.ok(isQuestionSlot(slot));
        const card = questionCard(slot, "SAT prep", type);
        assert.ok(card.question.length > 5 && card.options.length >= 2, slot);
        assert.ok(SLOT_FACT_LABEL[slot], slot);
      }
    }
    assert.equal(isStudentSlot("followers"), true);
    assert.equal(isStudentSlot("deadline"), false);
  });
});
