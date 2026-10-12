// Run with `npm test`. turnsFromMessages pairing after a reload, including the
// Pipeline V2 "Just talking" reply that replaces the saved preview summary.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (
  specifier: string,
  context: unknown,
  next: (s: string, c: unknown) => unknown,
) => unknown;
(
  nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }
).registerHooks({
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

type Mod = typeof import("./turns");

void (import("./turns") as Promise<Mod>).then(({ turnsFromMessages, withCard, splitCard, redoable }) => {
  type Msg = { role: "user" | "assistant"; content: string };
  const u = (content: string): Msg => ({ role: "user", content });
  const a = (content: string): Msg => ({ role: "assistant", content });
  const pairs = (msgs: Msg[]) =>
    turnsFromMessages(msgs).map((t) => [t.request, t.response]);

  test("a 'Just talking' reply that replaced the preview summary pairs with its own request", () => {
    // Saved: preview summary for turn 1, replaced in place by the chat reply.
    const msgs = [
      u("is chem hard?"),
      a("Chemistry can be tough at first..."),
      u("add chem review friday"),
      a("Add 'Chem review' · Fri"),
    ];
    assert.deepEqual(pairs(msgs), [
      ["is chem hard?", "Chemistry can be tough at first..."],
      ["add chem review friday", "Add 'Chem review' · Fri"],
    ]);
  });

  test("the turn after a 'Just talking' turn keeps its own reply", () => {
    const msgs = [
      u("plan my week"),
      a("Here's a casual answer"),
      u("what's due?"),
      a("Your essay is due Friday."),
    ];
    const turns = pairs(msgs);
    assert.equal(turns.length, 2);
    assert.deepEqual(turns[1], ["what's due?", "Your essay is due Friday."]);
  });

  test("older chats with two assistant messages in a row still show the later one", () => {
    const msgs = [
      u("make a plan"),
      a("New plan: SAT Prep"),
      a("Okay, nothing was added."),
      u("thanks"),
      a("Anytime!"),
    ];
    assert.deepEqual(pairs(msgs), [
      ["make a plan", "Okay, nothing was added."],
      ["thanks", "Anytime!"],
    ]);
  });

  test("a request with no saved reply yet gets an empty response", () => {
    assert.deepEqual(pairs([u("hello")]), [["hello", ""]]);
  });

  // Master fix B3: a question card is saved with its message and comes back as a card.
  const card = {
    questions: [{ id: "pending", question: "Which one?", options: ["SAT Reading", "SAT Math", "All of these"], multi: true }],
    pendingQuestion: { expiresAt: "2026-10-11T12:10:00Z" } as never,
  };
  const NOW = new Date("2026-10-11T12:00:00Z");

  test("B3: a saved card is hidden from the text and live again on the last turn", () => {
    const saved = withCard("Which SAT plan should I delete?", card);
    assert.equal(splitCard(saved).text, "Which SAT plan should I delete?");
    const turns = turnsFromMessages([u("take out all my SAT tasks"), a(saved)], [], NOW);
    assert.equal(turns[0].response, "Which SAT plan should I delete?");
    assert.deepEqual(turns[0].questions?.[0].options, ["SAT Reading", "SAT Math", "All of these"]);
    assert.equal(turns[0].questions?.[0].multi, true);
    assert.ok(turns[0].pendingQuestion);
  });

  test("B3: an answered or expired card comes back as text only", () => {
    const saved = withCard("Which one?", card);
    const answered = turnsFromMessages([u("delete sat"), a(saved), u("SAT Math"), a("Here's what I'd remove.")], [], NOW);
    assert.equal(answered[0].response, "Which one?");
    assert.equal(answered[0].questions, undefined);
    const late = turnsFromMessages([u("delete sat"), a(saved)], [], new Date("2026-10-11T13:00:00Z"));
    assert.equal(late[0].questions, undefined);
    // A clarify card without a pending question (ISEF's questions) stays live.
    const isef = turnsFromMessages([u("help me prepare for ISEF"), a(withCard("A few quick questions.", { questions: card.questions }))], [], NOW);
    assert.equal(isef[0].questions?.length, 1);
    assert.equal(splitCard("plain text").card, null);
    assert.equal(splitCard("x\n\n<!-- tangent:card %7Bbad -->").card, null);
  });

  test("Retry / Edit only offered on a turn that changed nothing", () => {
    const base = { id: "t", request: "hi", tools: [], sourcesChecked: [], response: "Hello" };
    assert.equal(redoable(base), true);
    assert.equal(redoable({ ...base, actionId: "a" }), false, "applied straight away");
    assert.equal(redoable({ ...base, applied: true }), false, "confirmed via its card");
    assert.equal(redoable({ ...base, changeSetId: "cs" }), false, "has a preview");
    assert.equal(redoable({ ...base, projectId: "p" }), false);
  });
});
