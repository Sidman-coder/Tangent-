// Run with `npm test`. Round 5A R2: "Since you mentioned…" recall.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./recall");

void (import("./recall.ts" as string) as Promise<Mod>).then(({ recallable, recallBlock, recallClause }) => {
  const facts = [
    { id: "f1", text: "You're too sleepy to think in the morning" },
    { id: "f2", text: "Grade: 11" },
    { id: "f3", text: "You want to make USACO Silver because your friends did" },
    { id: "f4", text: "you're too sleepy to think in the morning" },
  ];

  test("recall keeps personal facts, drops bookkeeping and duplicates", () => {
    assert.deepEqual(
      recallable(facts).map((f) => f.id),
      ["f1", "f3"]
    );
  });

  test("recall block lists ids and asks for 'Since you mentioned'", () => {
    const b = recallBlock(facts);
    assert.match(b, /\[f1\] You're too sleepy/);
    assert.match(b, /Since you mentioned/);
    assert.equal(recallBlock([{ id: "x", text: "Grade: 11" }]), "");
  });

  test("Round 5A R1: the onboarding why facts are recallable", () => {
    const why = [
      { id: "w1", text: "You lock in once you know the first step" },
      { id: "w2", text: "For you, a good month looks like: no cramming" },
      { id: "w3", text: "Why you want to lock in: last semester got away from me" },
    ];
    assert.deepEqual(recallable(why).map((f) => f.id), ["w1", "w2", "w3"]);
  });

  test("recall clause for a notification", () => {
    assert.equal(recallClause(facts[0]), "Since you mentioned you're too sleepy to think in the morning");
    assert.equal(recallClause(undefined), "");
  });
});
