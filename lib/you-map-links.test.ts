// Run with `npm test`. Round 5B Phase 2: the faint lines on "You, mapped".
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

void Promise.all([
  import("./you-map-links") as Promise<typeof import("./you-map-links")>,
  import("./you-map") as Promise<typeof import("./you-map")>,
]).then(([links, map]) => {
  const { timeBandsOf, weekdaysOf, keywordsOf, factLinks, usageByFact, projectLinks, MAX_LINKS } = links;
  type Entry = import("./types").ContextEntry;
  const fact = (id: string, text: string, factCategory: Entry["factCategory"], extra: Partial<Entry> = {}): Entry => ({
    id,
    timestamp: "2026-11-01T10:00:00Z",
    category: "preference",
    fact: text,
    source: "manual",
    factCategory,
    ...extra,
  });

  test("time bands: words and hours, a bare after-school hour reads as afternoon or evening", () => {
    assert.deepEqual(Array.from(timeBandsOf("Robotics Tue/Thu until 6")), ["evening"]);
    assert.deepEqual(Array.from(timeBandsOf("You focus best in the evening")), ["evening"]);
    assert.deepEqual(Array.from(timeBandsOf("Swim practice at 6am")), ["morning"]);
    assert.ok(timeBandsOf("Works best after school").has("afternoon"));
    assert.equal(timeBandsOf("You like short sessions").size, 0);
  });

  test("weekdays: short names, plurals, weekends and school nights", () => {
    assert.deepEqual(Array.from(weekdaysOf("Robotics Tue/Thu until 6")).sort(), ["thu", "tue"]);
    assert.deepEqual(Array.from(weekdaysOf("Shifts on Saturdays")), ["sat"]);
    assert.deepEqual(Array.from(weekdaysOf("Free on weekends")).sort(), ["sat", "sun"]);
    assert.equal(weekdaysOf("No phone on school nights").size, 5);
    assert.equal(weekdaysOf("Monitors the thread").size, 0);
  });

  test("keywords drop stopwords and plural s", () => {
    const k = keywordsOf("Essays are hard to start, and you want better essays");
    assert.ok(k.has("essay"));
    assert.ok(k.has("hard"));
    assert.ok(k.has("start"));
    assert.ok(!k.has("want"));
    assert.ok(!k.has("better"));
  });

  test("commitment ↔ how you work by time band or weekday; hard ↔ goal by keyword; same slot", () => {
    const grouped = map.groupFacts([
      fact("c1", "Robotics Tue/Thu until 6", "schedule"),
      fact("w1", "You focus best in the evening", "how_you_work"),
      fact("w2", "Tuesdays you're tired after practice", "how_you_work"),
      fact("w3", "You like 45 minute sessions", "how_you_work"),
      fact("h1", "Starting essays is hard", "whats_hard"),
      fact("g1", "Write a strong college essay", "goals"),
      fact("g2", "Get a 1500 on the SAT", "goals"),
      fact("f1", "Study engineering", "future", { slotKey: "career" }),
      fact("f2", "Maybe robotics engineering", "future", { slotKey: "career" }),
    ]);
    const got = factLinks(grouped).map((l) => `${[l.a, l.b].sort().join("-")}:${l.kind}`).sort();
    assert.deepEqual(got, ["c1-w1:time", "c1-w2:time", "f1-f2:slot", "g1-h1:hard-goal"]);
  });

  test("each fact keeps at most MAX_LINKS lines", () => {
    const grouped = map.groupFacts([
      fact("c1", "Practice every evening", "schedule"),
      ...[1, 2, 3, 4, 5].map((i) => fact(`w${i}`, `Evening habit number ${i}`, "how_you_work")),
    ]);
    const lines = factLinks(grouped);
    assert.equal(lines.filter((l) => l.a === "c1" || l.b === "c1").length, MAX_LINKS);
  });

  test("usage maps to plans by id, else by the new plan's title; unknown plans are dropped", () => {
    const plans = [{ id: "p1", title: "Robotics" }, { id: "p2", title: "SAT prep" }];
    const used = usageByFact(
      [
        { planId: "p1", planTitle: null, factIds: ["a", "b"] },
        { planId: null, planTitle: "sat prep", factIds: ["a"] },
        { planId: "gone", planTitle: null, factIds: ["c"] },
        { planId: "p1", planTitle: null, factIds: ["a"] },
      ],
      plans
    );
    assert.deepEqual(used.a.map((p) => p.id), ["p1", "p2"]);
    assert.deepEqual(used.b.map((p) => p.id), ["p1"]);
    assert.equal(used.c, undefined);
  });

  test("satellite lines: used facts and goals that share a word with the project", () => {
    const grouped = map.groupFacts([
      fact("g1", "Build a robot that wins regionals", "goals"),
      fact("g2", "Get a 1500 on the SAT", "goals"),
      fact("w1", "You focus best in the evening", "how_you_work"),
    ]);
    const plans = [{ id: "p1", title: "Regionals robot" }];
    const lines = projectLinks(grouped, plans, { w1: [plans[0]], gone: [plans[0]] });
    assert.deepEqual(
      lines.map((l) => `${l.a}>${l.b}:${l.kind}`).sort(),
      ["g1>project:p1:goal-project", "w1>project:p1:used"]
    );
  });
});
