import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { GuardConfig } from "./plan-guard";
import type { QualityCase } from "./plan-quality";

type Mod = typeof import("./plan-quality");
type Guard = typeof import("./plan-guard");

void Promise.all([import("./plan-quality.ts" as string) as Promise<Mod>, import("./plan-guard.ts" as string) as Promise<Guard>]).then(([{ gradePlanQuality, validateQualityFile }, guard]) => {
  const root = path.join(import.meta.dirname, "..", "..");
  const cfg = JSON.parse(readFileSync(path.join(root, "config", "plan-guard.json"), "utf8")) as GuardConfig;
  const file = JSON.parse(readFileSync(path.join(root, "lib", "pipeline", "fixtures", "plan-quality.json"), "utf8")) as { cases: QualityCase[] };

  test("Round 5A 2.4: plan-quality.json is valid and covers the four goals", () => {
    assert.deepEqual(validateQualityFile(file), []);
    assert.deepEqual(
      file.cases.map((c) => c.id),
      [
        "quality-competitive-programming",
        "quality-ap-chem-final",
        "quality-instagram-growth",
        "quality-college-essay",
        // Round 6 (item 2): the sim cases with their sim slots, graded for placement and reasons.
        "trust-priya-bakery",
        "trust-leo-test-friday",
        "trust-maya-final",
      ]
    );
    assert.ok(validateQualityFile({ version: 1, reference_date: "x", timezone: "", cases: [] }).length > 0);
  });

  const cp = file.cases[0];

  test("Round 5A 2.4: a specific brief passes the quality grade", () => {
    const g = gradePlanQuality(
      cp,
      {
        goal_line: "Get faster at USACO Bronze problems; round 1 is three prefix-sum sets.",
        steps: [
          { what: "Solve 3 USACO Bronze prefix-sum problems", why: "Tuesday is free all afternoon, so this gets the longest block.", why_ref: { kind: "calendar", ref: "2026-11-17" }, youll_have: "3 solved prefix-sum problems" },
          { what: "Debug last week's failed Codeforces submission", why: "You said mornings are hard, so this one sits after school.", why_ref: { kind: "fact", ref: "f2" }, youll_have: "one accepted submission" },
          { what: "Take a timed 3-problem USACO mock contest", why: "Saturday is open, which is enough time for a full timed run.", why_ref: { kind: "calendar", ref: "2026-11-21" }, youll_have: "a score to compare next round" },
        ],
      },
      cfg,
      guard
    );
    assert.deepEqual(g, { pass: true, failures: [] });
  });

  test("Round 5A 2.4: generic, boilerplate or off-topic briefs fail with reasons", () => {
    const g = gradePlanQuality(
      cp,
      {
        goal_line: "Get better and reach a top result.",
        steps: [
          { what: "Practice problems", why: "Stay consistent every day so you build momentum.", why_ref: null },
          { what: "Review notes", why: "Short.", why_ref: { kind: "fact", ref: "f9" } },
        ],
      },
      cfg,
      guard
    );
    assert.equal(g.pass, false);
    assert.ok(g.failures.some((f) => f.startsWith("goal line")), g.failures.join("|"));
    assert.ok(g.failures.some((f) => f.includes("step 1 fails the guard")), g.failures.join("|"));
    assert.ok(g.failures.some((f) => f.includes("name the topic")), g.failures.join("|"));
    assert.deepEqual(gradePlanQuality(cp, null, cfg, guard), { pass: false, failures: ["no brief (the call failed)"] });
  });
});
