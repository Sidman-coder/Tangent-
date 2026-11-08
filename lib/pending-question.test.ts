// Run with `npm test`. Answers to "Which one should I delete?" (A1): a typed
// or tapped answer picks candidates, cancels, asks again once, or is a new
// request routed as usual. It never becomes a plan.
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

type Mod = typeof import("./pending-question");

void (import("./pending-question") as Promise<Mod>).then(
  ({ makePendingQuestion, parsePendingQuestion, pendingQuestionCard, resolvePendingAnswer, taskCandidates, asksForCalendars, PENDING_TTL_MS }) => {
    const NOW = new Date("2026-10-11T12:00:00Z");
    const plans = makePendingQuestion(
      "plan",
      [
        { id: "p1", title: "Writing Portfolio" },
        { id: "p2", title: "Creative Writing Club" },
      ],
      "delete the writing stuff",
      NOW
    );

    test("the card: a button per candidate, then All of these", () => {
      const card = pendingQuestionCard(plans, "Which one should I delete?");
      assert.deepEqual(card.options, ["Writing Portfolio", "Creative Writing Club", "All of these"]);
      const one = makePendingQuestion("task", [{ id: "t1", title: "Essay draft" }], "x", NOW);
      assert.deepEqual(pendingQuestionCard(one, "?").options, ["Essay draft"]);
    });

    test("it holds for ten minutes, then is ignored", () => {
      const sent = JSON.parse(JSON.stringify(plans));
      assert.ok(parsePendingQuestion(sent, new Date(NOW.getTime() + 9 * 60 * 1000)));
      assert.equal(parsePendingQuestion(sent, new Date(NOW.getTime() + PENDING_TTL_MS + 1)), null);
      // An expiry pushed past ten minutes from now is refused too.
      assert.equal(parsePendingQuestion({ ...sent, expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString() }, NOW), null);
      assert.equal(parsePendingQuestion({ ...sent, kind: "everything" }, NOW), null);
      assert.equal(parsePendingQuestion("delete", NOW), null);
    });

    test("tapped or typed titles pick that candidate", () => {
      for (const text of ["Writing Portfolio", "the portfolio", "portfolio one", "creative writing", "the club"]) {
        const a = resolvePendingAnswer(text, plans);
        assert.equal(a.kind, "pick", text);
      }
      const a = resolvePendingAnswer("the club", plans);
      assert.deepEqual(a.kind === "pick" ? a.candidates.map((c) => c.id) : [], ["p2"]);
      const first = resolvePendingAnswer("the first one", plans);
      assert.deepEqual(first.kind === "pick" ? first.candidates.map((c) => c.id) : [], ["p1"]);
    });

    test("all / both / everything pick every candidate", () => {
      for (const text of ["All of these", "both", "everything", "all of them", "yes both"]) {
        const a = resolvePendingAnswer(text, plans);
        assert.deepEqual(a.kind === "pick" ? a.candidates.map((c) => c.id) : a.kind, ["p1", "p2"], text);
      }
    });

    test("cancel, never mind and no delete nothing", () => {
      for (const text of ["Cancel", "never mind", "no", "nope", "forget it", "neither"]) {
        assert.equal(resolvePendingAnswer(text, plans).kind, "cancel", text);
      }
    });

    test("a word both titles share is unclear: asked once more", () => {
      assert.equal(resolvePendingAnswer("writing", plans).kind, "unclear");
      assert.equal(resolvePendingAnswer("hmm", plans).kind, "unclear");
    });

    test("a new request drops the question instead of answering it", () => {
      for (const text of ["add soccer practice tomorrow at 5", "what's due this week?", "make me a plan for finals"]) {
        assert.equal(resolvePendingAnswer(text, plans).kind, "unrelated", text);
      }
    });

    // Transcript regression: "Which tasks should I remove?" answered with "my
    // SAT tasks" listed the calendars. It is a scoped delete of what it names.
    test("my SAT tasks answers Which tasks? as a delete, never a calendar list", () => {
      const scope = makePendingQuestion("scope", [], "delete them", NOW);
      const a = resolvePendingAnswer("my SAT tasks", scope);
      assert.equal(a.kind, "scope");
      assert.equal(a.kind === "scope" ? a.words : "", "my sat tasks");
      assert.equal(asksForCalendars("my SAT tasks"), false);
      assert.equal(asksForCalendars("what calendars do I have?"), true);
      assert.equal(asksForCalendars("move the SAT tasks to my School calendar"), false);
    });

    test("task candidates: whole words only, open and soonest first", () => {
      const tasks = [
        { id: "a", title: "Writing essay draft", date: "2026-10-14" },
        { id: "b", title: "Writing club", date: "2026-10-12" },
        { id: "c", title: "Rewriting notes", date: "2026-10-12" },
        { id: "d", title: "Writing recap", date: "2026-10-10", completed: true },
      ];
      assert.deepEqual(taskCandidates(tasks, "the writing stuff").map((t) => t.id), ["b", "a", "d"]);
      assert.deepEqual(taskCandidates(tasks, "essay").map((t) => t.id), ["a"]);
      assert.deepEqual(taskCandidates(tasks, "the").map((t) => t.id), []);
    });
  }
);

// Pipeline V2 (B1, B2): route questions. "What did you mean?" and "Which
// plan?" have one answer each, never "All of these".
void (import("./pending-question") as Promise<Mod>).then(
  ({ makePendingQuestion, parsePendingQuestion, pendingQuestionCard, resolvePendingAnswer, INTENT_CHOICE_IDS, NEW_PLAN_ID }) => {
    const NOW = new Date("2026-10-11T12:00:00Z");
    const DECISION = "22222222-2222-4222-8222-222222222222";
    const intent = makePendingQuestion(
      "intent",
      [
        { id: "plan", title: "Make a plan" },
        { id: "task", title: "Just add one task" },
        { id: "talk", title: "Just talking" },
      ],
      "prep stuff",
      NOW,
      { decisionId: DECISION }
    );
    const match = makePendingQuestion(
      "match",
      [
        { id: "icf", title: "ICF Prep" },
        { id: "essay", title: "ICF Essay" },
        { id: NEW_PLAN_ID, title: "New plan" },
      ],
      "add a checkpoint to my ICF plan",
      NOW,
      { mention: "my ICF plan", decisionId: "not-a-uuid" }
    );
    const picked = (text: string, q = intent) => {
      const a = resolvePendingAnswer(text, q);
      return a.kind === "pick" ? a.candidates.map((c) => c.id).join(",") : a.kind;
    };

    test("route questions: action route, no 'All of these', ids kept", () => {
      assert.equal(intent.action, "route");
      assert.equal(intent.decisionId, DECISION);
      assert.equal(match.decisionId, undefined);
      assert.equal(match.mention, "my ICF plan");
      assert.deepEqual(pendingQuestionCard(intent, "What did you mean?").options, ["Make a plan", "Just add one task", "Just talking"]);
      assert.deepEqual(pendingQuestionCard(match, "Which plan?").options, ["ICF Prep", "ICF Essay", "New plan"]);
      assert.deepEqual([...INTENT_CHOICE_IDS], ["plan", "task", "talk"]);
    });

    test("route questions survive the round trip; a delete kind on a route is refused", () => {
      const back = parsePendingQuestion(JSON.parse(JSON.stringify(intent)), NOW);
      assert.equal(back?.action, "route");
      assert.equal(back?.kind, "intent");
      assert.equal(back?.decisionId, DECISION);
      assert.equal(parsePendingQuestion(JSON.parse(JSON.stringify(match)), NOW)?.mention, "my ICF plan");
      assert.equal(parsePendingQuestion({ ...intent, kind: "plan" }, NOW), null);
      assert.equal(parsePendingQuestion({ ...intent, action: "delete" }, NOW), null);
    });

    test("intent answers: taps and the student's words", () => {
      assert.equal(picked("Make a plan"), "plan");
      assert.equal(picked("a plan"), "plan");
      assert.equal(picked("just one task"), "task");
      assert.equal(picked("Just talking"), "talk");
      assert.equal(picked("im just asking"), "talk");
      assert.equal(picked("all of these"), "unclear");
      assert.equal(picked("cancel"), "cancel");
    });

    test("match answers: words, sound-alikes, New plan, never all", () => {
      assert.equal(picked("the essay one", match), "essay");
      assert.equal(picked("ICF Prep", match), "icf");
      assert.equal(picked("eye see eff prep", match), "icf");
      assert.equal(picked("New plan", match), NEW_PLAN_ID);
      assert.equal(picked("a new one", match), NEW_PLAN_ID);
      assert.equal(picked("both", match), "unclear");
      assert.equal(picked("add math homework tomorrow at 5pm", match), "unrelated");
    });
  }
);
