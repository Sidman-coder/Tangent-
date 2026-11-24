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
  const { rankFacts, factLine, fitBudget, estimateTokens, clipTitle, dueNotInWeek, MAX_TITLE_CHARS, KEEP, MAX_FACTS, MIN_FACTS } = p;
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

  test("rankFacts: a round answer stays in its own project (Round 6)", () => {
    const facts = [
      fact("py", 'Python Competitive Programming Basics round 1, asked "Should next round include more practice problems, or fewer": More practice', { projectId: "python", factCategory: "how_you_work" }),
      fact("gen", "You focus best after dinner", { factCategory: "how_you_work" }),
    ];
    // A new chess plan (no project yet) and the chess project itself: no Python answer.
    assert.deepEqual(rankFacts(facts, { purpose: "plan", query: "chess plan more practice", now }).map((f) => f.id), ["gen"]);
    assert.deepEqual(rankFacts(facts, { purpose: "extend", projectId: "chess", query: "more practice", now }).map((f) => f.id), ["gen"]);
    // The Python project still gets it.
    assert.ok(rankFacts(facts, { purpose: "extend", projectId: "python", now }).some((f) => f.id === "py"));
  });

  test("rankFacts: near-identical facts go in once, the newer one (Round 6)", () => {
    const facts = [
      fact("old", "You can focus for about 45 minutes", { timestamp: "2026-10-01T12:00:00Z" }),
      fact("new", "You focus for about 45 minutes at a time", { timestamp: "2026-11-05T12:00:00Z" }),
      fact("night", "You focus best at night"),
      fact("morning", "You focus best in the morning"),
      fact("ninety", "You focus for about 90 minutes at a time"),
    ];
    const ids = rankFacts(facts, { purpose: "plan", now }).map((f) => f.id).sort();
    assert.deepEqual(ids, ["morning", "new", "night", "ninety"]);
    assert.equal(p.nearDuplicate("You focus best at night", "You focus best in the morning"), false);
  });

  test("packLogLine: section names and a token count, no student text (Round 6)", () => {
    assert.equal(
      p.packLogLine("plan", 1840, ["today", "facts", "summary"], ["summary"]),
      "[perf] pack plan: 1840 tok, kept [today, facts], dropped [summary]",
    );
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

  test("clipTitle: short titles pass, long ones are cut at a word with an ellipsis", () => {
    assert.equal(clipTitle("  Finish   chem lab "), "Finish chem lab");
    const long = "Keeping a weekly Sunday video upload going without my chem and algebra grades slipping while soccer season is on and finals come up";
    const out = clipTitle(long);
    assert.ok(out.length <= MAX_TITLE_CHARS);
    assert.ok(out.endsWith("…"));
    assert.ok(!out.slice(0, -1).endsWith(" "));
    assert.ok(long.startsWith(out.slice(0, -1)));
  });

  test("clipTitle: one unbroken string is cut hard", () => {
    const out = clipTitle("x".repeat(300));
    assert.equal(out.length, MAX_TITLE_CHARS);
    assert.ok(out.endsWith("…"));
  });

  test("dueNotInWeek: an assignment already in this week's list is not listed twice", () => {
    const due = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(dueNotInWeek(due, [{ id: "b" }]).map((t) => t.id), ["a", "c"]);
    assert.deepEqual(dueNotInWeek(due, []).map((t) => t.id), ["a", "b", "c"]);
  });
});
