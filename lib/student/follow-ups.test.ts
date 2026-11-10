// Run with `npm test`. The daily follow-up after onboarding: which question
// comes next, what a typed answer becomes, and the one-a-day rule.
// Same resolve hook as lib/context/context.test.ts.
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

type FU = typeof import("./follow-ups");
type Fact = import("./follow-ups").KnownFact;

void (import("./follow-ups") as Promise<FU>).then((fu) => {
  const { pickFollowUp, followUpById, replyFor, parseFollowUpState, followUpToday, withQuestion, closeFollowUp, followUpStorageKey, EMPTY_FOLLOW_UP_STATE } = fu;

  let n = 0;
  const fact = (text: string, extra: Partial<Fact> = {}): Fact => ({ id: `f${++n}`, fact: text, ...extra });
  // Every area known, so only the deeper questions are left.
  const allAreas: Fact[] = (
    ["identity", "schedule", "goals", "classes_activities", "how_you_work", "whats_hard", "future", "push_style"] as const
  ).map((c) => fact(`something about ${c}`, { factCategory: c }));

  test("follow-up: digs into a slip the student picked first", () => {
    const facts = [...allAreas, fact("When there's too much, you freeze", { slotKey: "onbSlip", factCategory: "whats_hard" })];
    const q = pickFollowUp(facts, []);
    assert.equal(q?.id, "fuSlipFreeze");
    assert.match(q!.ask, /piles up first, school or everything else/);
    assert.equal(q!.factCategory, "whats_hard");
  });

  test("follow-up: each onboarding slip has its own deeper question", () => {
    const slips: [string, string][] = [
      ["You tend to forget things when they aren't written down", "fuSlipForget"],
      ["You put things off until the last minute", "fuSlipPutOff"],
      ["You start strong, then fade", "fuSlipFade"],
      ["You often don't know where to start", "fuSlipStart"],
      ["You get stuck making things perfect", "fuSlipPerfect"],
    ];
    for (const [text, id] of slips) {
      assert.equal(pickFollowUp([...allAreas, fact(text, { slotKey: "onbSlip" })], [])?.id, id, text);
    }
  });

  test("follow-up: never asks again once answered or dismissed", () => {
    const slip = fact("When there's too much, you freeze", { slotKey: "onbSlip" });
    assert.equal(pickFollowUp([...allAreas, slip], ["fuSlipFreeze"]), null);
    assert.equal(pickFollowUp([...allAreas, slip, fact("What piles up first for you: homework", { slotKey: "fuSlipFreeze" })], []), null);
  });

  test("follow-up: what matters this year comes after slips", () => {
    const matters = fact("This year you care most about AP exams, college apps and a sport", { slotKey: "onbMatters" });
    assert.equal(pickFollowUp([...allAreas, matters], [])?.id, "fuApExams");
    assert.equal(pickFollowUp([...allAreas, matters], ["fuApExams"])?.id, "fuCollegeApps");
    assert.equal(pickFollowUp([...allAreas, matters], ["fuApExams", "fuCollegeApps"])?.id, "fuSport");
    assert.equal(pickFollowUp([...allAreas, matters], ["fuApExams", "fuCollegeApps", "fuSport"]), null);
  });

  test("follow-up: checks a guess before filling empty areas", () => {
    const guess = fact("You work best with music on", { unconfirmed: true, factCategory: "how_you_work" });
    const q = pickFollowUp([guess], []);
    assert.equal(q?.id, `check-${guess.id}`);
    assert.equal(q?.checkId, guess.id);
    assert.equal(q?.ask, "Tangent picked up that you work best with music on. Is that right?");
    // Dismissed guesses move on to the next thing.
    assert.equal(pickFollowUp([guess], [`check-${guess.id}`])?.id, "fuSchoolNight");
  });

  test("follow-up: asks about areas it knows nothing about, in order", () => {
    assert.equal(pickFollowUp([], [])?.id, "fuSchoolNight");
    assert.equal(pickFollowUp([fact("Practice till 6", { factCategory: "schedule" })], [])?.id, "fuThisYear");
    // A guess doesn't count as knowing the area.
    assert.equal(pickFollowUp([fact("Practice till 6", { factCategory: "schedule", unconfirmed: true })], [`check-f${n}`])?.id, "fuSchoolNight");
    // Nothing left to ask.
    assert.equal(pickFollowUp(allAreas, []), null);
  });

  test("follow-up: unconfirmed onboarding facts aren't dug into", () => {
    const slip = fact("When there's too much, you freeze", { slotKey: "onbSlip", unconfirmed: true });
    assert.notEqual(pickFollowUp([...allAreas, slip], [`check-${slip.id}`])?.id, "fuSlipFreeze");
  });

  test("followUpById: rebuilt from known questions only", () => {
    assert.equal(followUpById("fuSlipFreeze", [])?.lead, "What piles up first for you: ");
    assert.equal(followUpById("fuNope", []), null);
    const guess = fact("You like lo-fi while working", { unconfirmed: true });
    assert.equal(followUpById(`check-${guess.id}`, [guess])?.checkId, guess.id);
    assert.equal(followUpById(`check-${guess.id}`, [{ ...guess, unconfirmed: false }]), null);
    assert.equal(followUpById("check-missing", [guess]), null);
  });

  test("replyFor: a typed answer becomes a fact the student said", () => {
    const q = pickFollowUp([], [])!;
    assert.deepEqual(replyFor(q, "  Home at 4, practice till 6.  "), { kind: "fact", fact: "A normal school night: home at 4, practice till 6" });
    assert.deepEqual(replyFor(q, "idk"), { kind: "empty" });
    assert.deepEqual(replyFor(q, "   "), { kind: "empty" });
    assert.equal(replyFor(q, "I want to kill myself").kind, "distress");
  });

  test("replyFor: a guess check reads yes, no, or a correction", () => {
    const q = { lead: "", checkId: "abc" };
    assert.deepEqual(replyFor(q, "yes"), { kind: "confirm" });
    assert.deepEqual(replyFor(q, "Yep!"), { kind: "confirm" });
    assert.deepEqual(replyFor(q, "nope"), { kind: "reject" });
    assert.deepEqual(replyFor(q, "Only when I'm doing math"), { kind: "fact", fact: "Only when I'm doing math" });
    // Without a check, "yes" is just a (vague-ish) answer, not a confirm.
    assert.notEqual(replyFor({ lead: "x: " }, "yes").kind, "confirm");
  });

  test("one a day: shows the open one, else fetches once a day", () => {
    const today = "2026-11-09";
    assert.equal(followUpToday(EMPTY_FOLLOW_UP_STATE, today), "fetch");
    const q = pickFollowUp([], [])!;
    const asked = withQuestion(EMPTY_FOLLOW_UP_STATE, today, q);
    assert.equal(followUpToday(asked, today), "show");
    // Stays until answered or dismissed, even on later days.
    assert.equal(followUpToday(asked, "2026-11-12"), "show");
    const closed = closeFollowUp(asked, today);
    assert.equal(closed.current, null);
    assert.deepEqual(closed.asked, [q.id]);
    assert.equal(followUpToday(closed, today), "none");
    assert.equal(followUpToday(closed, "2026-11-10"), "fetch");
    // Nothing to ask today: quiet until tomorrow.
    assert.equal(followUpToday(withQuestion(EMPTY_FOLLOW_UP_STATE, today, null), today), "none");
  });

  test("one a day: state survives storage and rejects junk", () => {
    const q = pickFollowUp([fact("x", { unconfirmed: true })], [])!;
    const state = withQuestion({ ...EMPTY_FOLLOW_UP_STATE, asked: ["fuPush"] }, "2026-11-09", q);
    assert.deepEqual(parseFollowUpState(JSON.stringify(state)), state);
    assert.deepEqual(parseFollowUpState("{not json"), EMPTY_FOLLOW_UP_STATE);
    assert.deepEqual(parseFollowUpState(JSON.stringify({ ...state, v: 2 })), EMPTY_FOLLOW_UP_STATE);
    const bad = parseFollowUpState(JSON.stringify({ ...state, day: "monday", current: { ...q, slotKey: "has space" }, asked: [1, "a"] }));
    assert.deepEqual(bad, { v: 1, day: null, current: null, asked: ["a"] });
    assert.equal(followUpStorageKey(" Sam@Example.com "), "tangent-follow-up:sam@example.com");
  });
});
