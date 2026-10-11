// Run with `npm test`. The plan matcher (B2): normalized names, nicknames,
// typos, sound-alikes, whole words only, and the sure / unsure / none call.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

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

type Mod = typeof import("./match");

void (import("./match") as Promise<Mod>).then(
  ({ matchPlan, normalizeTitle, nameWords, collapseSpelledLetters, jaroWinkler, soundex, aliasFor, MATCH_THRESHOLDS }) => {
    const NOW = new Date("2026-10-11T12:00:00Z");
    const ICF = { id: "icf", title: "ICF Prep" };
    const ESSAY = { id: "essay", title: "ICF Essay" };
    const SAT = { id: "sat", title: "SAT Prep" };
    const SAT_W = { id: "satw", title: "SAT Writing Skills Sprint" };
    const SAT_M = { id: "satm", title: "SAT Math Mastery Plan" };
    const SPANISH = { id: "sp", title: "Spanish Vocab" };

    const sure = (mention: string, plans: Parameters<typeof matchPlan>[1]) => {
      const r = matchPlan(mention, plans, NOW);
      return r.decision === "sure" ? r.target.id : r.decision;
    };

    test("normalizing: iCF = I.C.F. = icf = i c f", () => {
      for (const s of ["iCF", "I.C.F.", "icf", "i c f", "ICF"]) assert.equal(normalizeTitle(s), "icf", s);
      assert.equal(normalizeTitle("S.A.T. Prep"), "sat prep");
      assert.equal(normalizeTitle("Mom's   B-day!"), "moms b day");
      assert.deepEqual(nameWords("my ICF prep plan"), ["icf", "prep"]);
    });

    test("exact titles and normalized names are sure", () => {
      assert.equal(sure("ICF Prep", [ICF, ESSAY, SAT]), "icf");
      assert.equal(sure("my iCF prep", [ICF, ESSAY, SAT]), "icf");
      assert.equal(sure("the I.C.F. prep plan", [ICF, ESSAY, SAT]), "icf");
    });

    test("ICF Prep vs ICF Essay on just 'ICF' is unsure, with both as candidates", () => {
      const r = matchPlan("my ICF plan", [ICF, ESSAY, SAT], NOW);
      assert.equal(r.decision, "unsure");
      assert.deepEqual(r.candidates.map((c) => c.id).sort(), ["essay", "icf"]);
    });

    test("one plan with that word is sure", () => {
      assert.equal(sure("ICF", [ICF, SAT]), "icf");
      assert.equal(sure("my SAT plan", [ICF, SAT]), "sat");
    });

    test("a word both plans share is unsure: 'my prep' with ICF Prep and SAT Prep", () => {
      assert.equal(matchPlan("my prep", [ICF, SAT], NOW).decision, "unsure");
      assert.equal(matchPlan("the writing stuff", [SAT_W, { id: "cw", title: "Creative Writing Club" }], NOW).decision, "unsure");
    });

    test("transcript: 'the SAT writing skills sprint one' and 'writing' after asking", () => {
      assert.equal(sure("the SAT writing skills sprint one", [SAT_W, SAT_M]), "satw");
      assert.equal(sure("the writing one", [SAT_W, SAT_M]), "satw");
      assert.equal(matchPlan("my SAT tasks", [SAT_W, SAT_M], NOW).decision, "unsure");
    });

    test("sound-alike: spelled letters and Soundex", () => {
      assert.deepEqual(collapseSpelledLetters(["eye", "see", "eff", "prep"]), ["icf", "prep"]);
      assert.deepEqual(collapseSpelledLetters(["see", "you"]), ["cu"]);
      assert.deepEqual(collapseSpelledLetters(["eye", "prep"]), ["eye", "prep"]);
      assert.equal(sure("my eye see eff prep", [ICF, SAT]), "icf");
      assert.equal(soundex("Robert"), soundex("Rupert"));
      assert.equal(sure("spannish vocab", [SPANISH, SAT]), "sp");
    });

    test("typos within whole words: Jaro-Winkler", () => {
      assert.ok(jaroWinkler("martha", "marhta") > 0.95);
      assert.equal(jaroWinkler("abc", "abc"), 1);
      assert.equal(sure("Spansh Vocab", [SPANISH, SAT]), "sp");
    });

    test("whole words only: SAT never matches Saturday, AP never matches APUSH", () => {
      const sat = { id: "satur", title: "Saturday Chores" };
      assert.equal(matchPlan("SAT", [sat], NOW).decision, "none");
      assert.equal(matchPlan("AP", [{ id: "ap", title: "APUSH Review" }], NOW).decision, "none");
      assert.equal(sure("SAT", [sat, SAT]), "sat");
    });

    test("a saved nickname is sure, even with no shared words", () => {
      const withAlias = { ...ICF, aliases: ["the big interview"] };
      assert.equal(sure("the big interview", [withAlias, ESSAY]), "icf");
      assert.equal(aliasFor("my eye see eff prep"), "eye see eff prep");
      assert.equal(aliasFor("my plan"), "");
    });

    test("recency breaks a near-tie but never makes an unsure match sure alone", () => {
      const recent = { ...ICF, activeAt: "2026-10-10T00:00:00Z" };
      const r = matchPlan("ICF", [recent, ESSAY], NOW);
      assert.equal(r.decision, "unsure");
      assert.equal(r.candidates[0].id, "icf");
      assert.ok(MATCH_THRESHOLDS.recencyBonus < MATCH_THRESHOLDS.gap);
    });

    test("nothing close, or only generic words: none (a new plan)", () => {
      assert.equal(matchPlan("guitar practice", [ICF, SAT], NOW).decision, "none");
      assert.equal(matchPlan("my plan", [ICF, SAT], NOW).decision, "none");
      assert.equal(matchPlan("anything", [], NOW).decision, "none");
    });

    test("thresholds are ordered sensibly", () => {
      const T = MATCH_THRESHOLDS;
      assert.equal(T.sure, 0.88);
      assert.equal(T.gap, 0.08);
      assert.equal(T.unsure, 0.6);
      assert.ok(T.unsure < T.soundAlike && T.soundAlike < T.sure && T.sure < T.contains);
    });
  }
);
