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

type Pack = typeof import("./context-pack");

void (import("./context-pack") as Promise<Pack>).then((p) => {
  const { rankFacts, factLine, fitBudget, estimateTokens, KEEP, MAX_FACTS, MIN_FACTS } = p;
  const now = new Date("2026-11-08T12:00:00Z");
  const fact = (id: string, text: string, over: Partial<Parameters<typeof rankFacts>[0][number]> = {}) => ({
    id,
    text,
    timestamp: "2026-11-01T12:00:00Z",
    factSource: "said" as const,
    ...over,
  });

  test("rankFacts: what the call is about comes first", () => {
    const facts = [
      fact("a", "You play soccer on Mondays", { factCategory: "classes_activities" }),
      fact("b", "You want a 1450 on the SAT", { factCategory: "goals" }),
      fact("c", "You like dogs", { factCategory: "identity" }),
    ];
    const ranked = rankFacts(facts, { purpose: "plan", query: "SAT prep plan", now });
    assert.equal(ranked[0].id, "b");
    assert.equal(ranked[ranked.length - 1].id, "c");
  });

  test("rankFacts: this project's facts beat another project's", () => {
    const facts = [
      fact("mine", "Robotics club is just you so far", { projectId: "p1" }),
      fact("other", "You can give 4 hrs a week to SAT prep", { projectId: "p2" }),
    ];
    const ranked = rankFacts(facts, { purpose: "extend", projectId: "p1", now });
    assert.equal(ranked[0].id, "mine");
  });

  test("rankFacts: confirmed and recent beat guessed and old", () => {
    const facts = [
      fact("old", "You work best in the evening", { factCategory: "how_you_work", timestamp: "2025-01-01T00:00:00Z" }),
      fact("guess", "You work best after dinner", { factCategory: "how_you_work", factSource: "guessed", unconfirmed: true }),
      fact("new", "You work best right after school", { factCategory: "how_you_work", confidence: 1, timestamp: "2026-11-07T00:00:00Z" }),
    ];
    const ranked = rankFacts(facts, { purpose: "plan", now });
    assert.equal(ranked[0].id, "new");
  });

  test("rankFacts: 10–15 facts, no duplicates", () => {
    const many = Array.from({ length: 40 }, (_, i) => fact(`f${i}`, `Fact number ${i}`));
    const ranked = rankFacts([...many, fact("dup", "Fact number 0")], { purpose: "chat", now });
    assert.ok(ranked.length >= MIN_FACTS && ranked.length <= MAX_FACTS);
    assert.equal(new Set(ranked.map((f) => f.text)).size, ranked.length);
    assert.equal(rankFacts(many.slice(0, 3), { purpose: "chat", now }).length, 3);
  });

  test("factLine: guesses are never stated as true", () => {
    assert.equal(factLine(fact("a", "You like mornings")), "- You like mornings");
    assert.match(factLine(fact("b", "You like mornings", { factSource: "guessed" })), /guess, not confirmed/);
  });

  test("fitBudget: drops the least important first, never the kept ones", () => {
    const sections = [
      { key: "today", text: "TODAY: Sunday", priority: KEEP },
      { key: "facts", text: "x".repeat(400), priority: 90 },
      { key: "classes", text: "y".repeat(400), priority: 40 },
      { key: "summary", text: "z".repeat(400), priority: 20 },
    ];
    const r = fitBudget(sections, 150);
    assert.deepEqual(r.dropped, ["summary", "classes"]);
    assert.ok(r.text.startsWith("TODAY: Sunday"));
    assert.ok(r.tokens <= 150);
    assert.deepEqual(fitBudget(sections, 10_000).dropped, []);
  });

  test("fitBudget: cuts short when even the kept sections are too long", () => {
    const r = fitBudget([{ key: "today", text: "word ".repeat(400), priority: KEEP }], 50);
    assert.ok(r.tokens <= 50);
    assert.ok(r.text.endsWith("…"));
  });

  test("estimateTokens: about four characters each", () => {
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
  });
});
