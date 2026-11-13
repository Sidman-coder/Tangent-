// Run with `npm test`. "You, mapped": grouping, origins and the summary line.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ContextEntry } from "./types";

// you-map.ts imports lib/student/facts without an extension, as the app does.
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

const fact = (fact: string, over: Partial<ContextEntry> = {}): ContextEntry => ({
  id: fact,
  timestamp: "2026-11-08T10:00:00Z",
  category: "general",
  fact,
  source: "chat",
  ...over,
});

type Mod = typeof import("./you-map");

void (import("./you-map") as Promise<Mod>).then(({ groupFacts, groupOf, initialsOf, mapSummary, originOf, projectFacts }) => {
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

  // Round 5A, 1.3: facts about one project are shown under it, not as global Commitments.
  test("a project's facts leave the global areas and show under the project", () => {
    const entries = [
      fact("You can handle about 3 hrs of work on a school night", { factCategory: "how_you_work" }),
      fact("Science fair needs to be done by end of term", { id: "p1", factCategory: "schedule", projectId: "plan-1" }),
      fact("You can give 4 hrs a week to Science fair", { id: "p2", factCategory: "schedule", projectId: "plan-1" }),
      fact("Gone project fact", { id: "p3", factCategory: "schedule", projectId: "plan-gone" }),
    ];
    const grouped = groupFacts(entries);
    assert.equal(grouped.find((g) => g.group.key === "commitments")?.facts.length, 0, "nothing global under Commitments");
    assert.equal(grouped.find((g) => g.group.key === "work")?.facts.length, 1);
    const byProject = projectFacts(entries, [
      { id: "plan-1", title: "Science fair" },
      { id: "plan-2", title: "Empty project" },
    ]);
    assert.equal(byProject.length, 1, "projects with no facts are left out; so are facts of deleted projects");
    assert.equal(byProject[0].title, "Science fair");
    assert.deepEqual(byProject[0].facts.map((f) => f.id), ["p1", "p2"]);
  });

  test("the same fact written two ways is shown once", () => {
    const grouped = groupFacts([
      fact("You can give 4 hrs a week", { id: "a", factCategory: "schedule" }),
      fact("You can give 4 hours a week.", { id: "b", factCategory: "schedule" }),
    ]);
    assert.equal(grouped.find((g) => g.group.key === "commitments")?.facts.length, 1);
  });
});
