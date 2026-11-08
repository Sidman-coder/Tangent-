// Run with `npm test`. Master fix Phase 4: chat titles and new-topic detection.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./chat-title");

void (import("./chat-title.ts" as string) as Promise<Mod>).then(({ cleanTitle, fallbackTitle, isNewTopic }) => {
  test("a model title is cleaned to at most six words", () => {
    assert.equal(cleanTitle('"SAT math prep plan."'), "SAT math prep plan");
    assert.equal(cleanTitle("Title: chemistry test review"), "Chemistry test review");
    assert.equal(cleanTitle("one two three four five six seven eight"), "One two three four five six");
    assert.equal(cleanTitle("  "), "");
  });

  test("the fallback title drops filler from the request", () => {
    assert.equal(fallbackTitle("Can you help me study for the SAT on Dec 6"), "Study for the SAT on Dec");
    assert.equal(fallbackTitle("hey tangent, I want to be like Mike Tyson"), "Be like Mike Tyson");
    assert.equal(fallbackTitle("Could you make me a plan for the AP Bio exam?"), "AP Bio exam", "not 'Make me a plan for the'");
    assert.equal(fallbackTitle("make me a plan to learn guitar chords"), "Learn guitar chords");
    assert.equal(fallbackTitle("???"), "New chat");
  });

  test("a new subject is spotted; follow-ups and short replies are not", () => {
    const chat = ["help me study for the SAT", "add more math practice sessions"];
    assert.equal(isNewTopic(chat, "remind me to buy groceries for the family dinner"), true);
    assert.equal(isNewTopic(chat, "move the math practice to Thursday evenings"), false, "shares a word");
    assert.equal(isNewTopic(chat, "what about doing it on weekends instead"), false, "a follow-up");
    assert.equal(isNewTopic(chat, "yes"), false);
    assert.equal(isNewTopic(["help me study for the SAT"], "remind me to buy groceries for dinner"), false, "too early to tell");
  });
});
