// Run with `npm test`. "You, mapped": grouping, origins and the summary line.
import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { groupFacts, groupOf, initialsOf, mapSummary, originOf } from "./you-map.ts";
import type { ContextEntry } from "./types";

const fact = (fact: string, over: Partial<ContextEntry> = {}): ContextEntry => ({
  id: fact,
  timestamp: "2026-11-08T10:00:00Z",
  category: "general",
  fact,
  source: "chat",
  ...over,
});

test("each student-model category lands in one of the six areas", () => {
  assert.equal(groupOf(fact("x", { factCategory: "goals" })), "goals");
  assert.equal(groupOf(fact("x", { factCategory: "schedule" })), "commitments");
  assert.equal(groupOf(fact("x", { factCategory: "classes_activities" })), "classes");
  assert.equal(groupOf(fact("x", { factCategory: "push_style" })), "work");
  assert.equal(groupOf(fact("x", { factCategory: "identity" })), "work");
  assert.equal(groupOf(fact("x", { factCategory: "whats_hard" })), "hard");
  assert.equal(groupOf(fact("x", { factCategory: "future" })), "future");
  // Older rows with only the legacy category.
  assert.equal(groupOf(fact("x", { category: "goal" })), "goals");
  assert.equal(groupOf(fact("x", { category: "commitment" })), "commitments");
});

test("origin: a guess stays a guess until confirmed; seen reads as noticed", () => {
  assert.equal(originOf(fact("x", { unconfirmed: true, factSource: "said" })), "guess");
  assert.equal(originOf(fact("x", { factSource: "guessed" })), "guess");
  assert.equal(originOf(fact("x", { factSource: "seen" })), "noticed");
  assert.equal(originOf(fact("x")), "said");
});

test("groupFacts keeps all six areas in order, empty ones included", () => {
  const grouped = groupFacts([fact("Make varsity", { factCategory: "goals" })]);
  assert.equal(grouped.length, 6);
  assert.equal(grouped[0].group.key, "goals");
  assert.equal(grouped[0].facts.length, 1);
  assert.ok(grouped.slice(1).every((g) => g.facts.length === 0));
});

test("the summary names the biggest areas and counts guesses", () => {
  const grouped = groupFacts([
    fact("a", { factCategory: "goals" }),
    fact("b", { factCategory: "goals" }),
    fact("c", { factCategory: "how_you_work" }),
    fact("d", { factCategory: "whats_hard", unconfirmed: true }),
  ]);
  const line = mapSummary(grouped);
  assert.match(line, /^Tangent knows 4 things about you, mostly your goals and /);
  assert.match(line, /One is a guess for you to confirm\.$/);
  assert.match(mapSummary(groupFacts([])), /doesn't know anything/);
});

test("initials", () => {
  assert.equal(initialsOf("Juan Ruiz"), "JR");
  assert.equal(initialsOf("juann"), "J");
  assert.equal(initialsOf("  "), "You");
});
