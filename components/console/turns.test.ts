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

void (import("./turns") as Promise<Mod>).then(({ turnsFromMessages }) => {
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
});
