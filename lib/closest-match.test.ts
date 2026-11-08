// Run with `npm test`. Master fix B5/B6 (Transcript 1): typo'd delete words,
// "the closest is …", never giving up, and the multi-select delete card.
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

type Close = typeof import("./closest-match");
type Pending = typeof import("./pending-question");
type Scope = typeof import("./delete-scope");

void Promise.all([
  import("./closest-match") as Promise<Close>,
  import("./pending-question") as Promise<Pending>,
  import("./delete-scope") as Promise<Scope>,
]).then(([close, pending, scope]) => {
  const { fixIntentTypos, intentTypo, closestMatch, closestQuestion, mentionFor, aOrAn } = close;
  const { makePendingQuestion, pendingQuestionCard, parsePendingQuestion, resolvePendingAnswer } = pending;
  const NOW = new Date("2026-10-11T12:00:00Z");

  // Transcript 1's calendar: two SAT plans, neither says "writing".
  const SAT = [
    { id: "p-read", title: "SAT Reading Score Boost", hint: "Reading passages, grammar drills, vocab review" },
    { id: "p-math", title: "SAT Math Geometry Sprint", hint: "Circle theorems, triangles, algebra review" },
  ];
  const tasks = [
    { id: "r1", title: "Reading passages", planId: "p-read" },
    { id: "r2", title: "Grammar drills", planId: "p-read" },
    { id: "m1", title: "Circle theorems", planId: "p-math" },
    { id: "m2", title: "Triangle practice", planId: "p-math" },
    { id: "x1", title: "Soccer practice", planId: null },
  ];
  const plans = SAT.map(({ id, title }) => ({ id, title }));

  test("typo'd intent words read as the word; real words stay", () => {
    assert.equal(fixIntentTypos("deltet my writing stuff for sat"), "delete my writing stuff for sat");
    for (const [typo, word] of [["delte", "delete"], ["remvoe", "remove"], ["cancle", "cancel"], ["Deltet", "delete"], ["dleete", "delete"], ["remoce", "remove"]]) {
      assert.equal(intentTypo(typo), word, typo);
    }
    for (const real of ["remote", "delta", "cancer", "candle", "clean", "deleted", "removed", "cancelled", "relate", "delete", "sat"]) {
      assert.equal(intentTypo(real), null, real);
    }
  });

  test("the closest plan: writing is the SAT reading & writing plan, not math", () => {
    const near = closestMatch(["writing", "sat"], SAT);
    assert.equal(near?.candidate.id, "p-read");
    assert.deepEqual(near?.missing, ["writing"]);
    assert.equal(near?.note, "reading & writing");
    assert.equal(closestMatch(["geometry"], SAT)?.candidate.id, "p-math");
    assert.equal(closestMatch(["calc"], SAT)?.candidate.id, "p-math");
    // Shared or unrelated words: no guess.
    assert.equal(closestMatch(["sat"], SAT), null);
    assert.equal(closestMatch(["piano"], SAT), null);
  });

  test("the question names what's missing and the closest, a/an by sound", () => {
    const mention = mentionFor(["writing", "sat"], SAT, ["writing"]);
    assert.equal(mention, "SAT writing");
    assert.equal(
      closestQuestion("plan", mention, "SAT Reading Score Boost", "reading & writing"),
      "You don't have an SAT writing plan. The closest is SAT Reading Score Boost (reading & writing). Delete that?"
    );
    assert.equal(aOrAn("SAT"), "an");
    assert.equal(aOrAn("PSAT"), "a");
    assert.equal(aOrAn("ICF"), "an");
    assert.equal(aOrAn("essay"), "an");
    assert.equal(aOrAn("writing"), "a");
  });

  test("Transcript 1, step 1: take out all my SAT tasks asks which, with toggle chips", () => {
    const plan = scope.planBulkDelete("take out all my SAT tasks", tasks, plans);
    assert.equal(plan?.kind, "ask");
    const ask = plan as Extract<NonNullable<typeof plan>, { kind: "ask" }>;
    assert.deepEqual(ask.candidates?.map((c) => c.id), ["p-read", "p-math"]);
    const q = makePendingQuestion("plan", ask.candidates ?? [], "take out all my SAT tasks", NOW);
    const card = pendingQuestionCard(q, ask.message);
    assert.equal(card.multi, true);
    assert.deepEqual(card.options, ["SAT Reading Score Boost", "SAT Math Geometry Sprint", "All of these"]);
  });

  test("Transcript 1, steps 2–4: the writing thingie / stuff / deltet … for sat find the closest, never give up", () => {
    const q = makePendingQuestion("plan", SAT, "take out all my SAT tasks", NOW);
    for (const text of ["The writing thingie", "the writing stuff", "deltet my writing stuff for sat"]) {
      const a = resolvePendingAnswer(text, q);
      assert.equal(a.kind, "closest", text);
      if (a.kind === "closest") {
        assert.equal(a.candidate.id, "p-read", text);
        assert.equal(a.mention, "SAT writing", text);
        assert.equal(a.note, "reading & writing", text);
      }
    }
  });

  test("the closest question: Delete X / yes picks it, Pick another, Cancel, a name", () => {
    const q = makePendingQuestion("plan", [SAT[0], SAT[1]], "the writing thingie", NOW, { closest: { mention: "SAT writing", note: "reading & writing" } });
    const card = pendingQuestionCard(q, "?");
    assert.deepEqual(card.options, ["Delete SAT Reading Score Boost", "Pick another"]);
    assert.equal(card.instant, true);
    const round = parsePendingQuestion(JSON.parse(JSON.stringify(q)), NOW);
    assert.deepEqual(round?.closest, { mention: "SAT writing", note: "reading & writing" });
    assert.equal(round?.candidates[0].hint, SAT[0].hint);
    const ids = (text: string) => {
      const a = resolvePendingAnswer(text, q);
      return a.kind === "pick" ? a.candidates.map((c) => c.id).join(",") : a.kind;
    };
    assert.equal(ids("Delete SAT Reading Score Boost"), "p-read");
    assert.equal(ids("yes"), "p-read");
    assert.equal(ids("yeah delete that"), "p-read");
    assert.equal(ids("the writing stuff"), "p-read");
    assert.equal(ids("Pick another"), "another");
    assert.equal(ids("no, another one"), "another");
    assert.equal(ids("the math one"), "p-math");
    assert.equal(ids("Cancel"), "cancel");
  });

  test("B6: tapped chips and typed lists pick exactly those plans", () => {
    const q = makePendingQuestion("plan", SAT, "take out all my SAT tasks", NOW);
    const ids = (text: string) => {
      const a = resolvePendingAnswer(text, q);
      return a.kind === "pick" ? a.candidates.map((c) => c.id).join(",") : a.kind;
    };
    assert.equal(ids("SAT Reading Score Boost, SAT Math Geometry Sprint"), "p-read,p-math");
    assert.equal(ids("SAT Reading Score Boost and SAT Math Geometry Sprint"), "p-read,p-math");
    assert.equal(ids("SAT Math Geometry Sprint"), "p-math");
    assert.equal(ids("writing and math"), "p-read,p-math");
    assert.equal(ids("All of these"), "p-read,p-math");
  });

  test("a delete with no exact plan, typo'd, offers the closest instead of nothing", () => {
    const plan = scope.planBulkDelete("deltet my writing stuff for sat", tasks, plans);
    assert.equal(plan?.kind, "ask");
    const ask = plan as Extract<NonNullable<typeof plan>, { kind: "ask" }>;
    assert.equal(ask.message, "You don't have an SAT writing plan. The closest is SAT Reading Score Boost (reading & writing). Delete that?");
    assert.equal(ask.closest?.mention, "SAT writing");
    assert.deepEqual(ask.candidates?.map((c) => c.id), ["p-read", "p-math"]);
    // Nothing close: still asks, never guesses.
    const none = scope.planBulkDelete("delete my piano stuff", tasks, plans);
    assert.equal(none?.kind, "ask");
    assert.equal((none as { closest?: unknown }).closest, undefined);
  });
});
