// Run with `npm test`. Round 5B Phase 3: adding and telling facts on "You, mapped".
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
  import("./you-map-edit") as Promise<typeof import("./you-map-edit")>,
  import("./you-map") as Promise<typeof import("./you-map")>,
  import("./student/sensitive") as Promise<typeof import("./student/sensitive")>,
]).then(([edit, map, sensitive]) => {
  const { AREA_CATEGORY, localFact, tellReply, NOT_KEPT } = edit;

  test("+ Add in each area writes a fact that lands back in that area", () => {
    for (const g of map.MAP_GROUPS) {
      const c = AREA_CATEGORY[g.key];
      assert.equal(map.groupOf({ factCategory: c.factCategory, category: c.category }), g.key, g.key);
    }
  });

  test("the sample's local add keeps the area's category", () => {
    const r = localFact("Chess club on Fridays at lunch", { factCategory: "classes_activities" });
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.entry.factCategory, "classes_activities");
      assert.equal(map.groupOf(r.entry), "classes");
      assert.equal(r.entry.source, "manual");
    }
  });

  test("the sensitive filter stops a health or family detail, even in the sample", () => {
    for (const text of ["I take ADHD meds every morning", "My parents fight a lot at night"]) {
      const r = localFact(text, { factCategory: "how_you_work" });
      assert.equal(r.ok, false, text);
      if (!r.ok) assert.equal(r.error, NOT_KEPT);
    }
  });

  test("a Tell with no area is sorted by what it says (\"after school\" is a time, not the future)", () => {
    const r = localFact("I work best right after school, before dinner");
    assert.ok(r.ok);
    if (r.ok) assert.equal(map.groupOf(r.entry), "work");
    const f = localFact("I want to study engineering after high school");
    assert.ok(f.ok);
    if (f.ok) assert.equal(map.groupOf(f.entry), "future");
  });

  test("an empty add is not kept", () => {
    assert.equal(localFact("   ").ok, false);
  });

  test("Tangent's reply names the area for one fact and lists several", () => {
    const one = tellReply("robotics", [{ fact: "Robotics Tue/Thu until 6", factCategory: "schedule", category: "commitment" }]);
    assert.match(one, /under Commitments/);
    assert.match(one, /Robotics Tue\/Thu until 6/);
    const two = tellReply("x", [
      { fact: "A", factCategory: "goals", category: "goal" },
      { fact: "B", factCategory: "whats_hard", category: "general" },
    ]);
    assert.match(two, /remember 2 things/);
    assert.match(two, /• B \(What's hard\)/);
  });

  test("nothing kept: the error is shown, else a gentle nudge", () => {
    assert.equal(tellReply("x", [], NOT_KEPT), NOT_KEPT);
    assert.match(tellReply("hmm", []), /Nothing new to keep/);
  });

  test("distress gets the distress reply, never a fact", () => {
    const text = "I want to die";
    assert.ok(sensitive.looksDistressed(text));
    assert.equal(tellReply(text, []), sensitive.DISTRESS_REPLY);
  });
});
