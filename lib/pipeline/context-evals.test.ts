// Run with `npm test`. Round 4 Phase 2.5: the context engine's eval set is
// valid, slot coverage holds (rules only, no AI), and the swap test's two
// students really give the planner two different pictures. The paid half (two
// plans per goal, graded by gradeSwap) is `npm run eval:pipeline -- --context`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

// Same resolve hook as round2-evals.test.ts: extensionless and "@/" imports.
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(path.resolve(import.meta.dirname, "..", ".."), s.slice(2))).href;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(s)) {
      try {
        return next(`${s}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(s, context);
  },
});

type Grade = typeof import("./grade");
type Slots = typeof import("../context/goal-slots");
type Pack = typeof import("../student/context-pack");

void Promise.all([
  import("./grade") as Promise<Grade>,
  import("../context/goal-slots") as Promise<Slots>,
  import("../student/context-pack") as Promise<Pack>,
]).then(([grade, slots, pack]) => {
  const { ContextEvalFileSchema, gradeSwap } = grade;
  const { goalTypeOf, inferExtraSlots, nextQuestions, isQuestionSlot } = slots;
  const { rankFacts, factLine } = pack;
  const raw = JSON.parse(readFileSync(new URL("./fixtures/context.json", import.meta.url), "utf8")) as unknown;
  const file = ContextEvalFileSchema.parse(raw);
  const now = new Date(`${file.reference_date}T12:00:00Z`);

  /** Every slot Tangent would ask for this goal, answering each as it goes. */
  function asked(text: string): string[] {
    const type = goalTypeOf(text);
    let s = { type, filled: new Set(Object.keys(inferExtraSlots(text, now))), skipped: new Set<string>(), asked: 0, stopped: false };
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const turn = nextQuestions(s);
      if (turn.type === "draft") break;
      out.push(...turn.slots);
      s = { ...s, filled: new Set([...Array.from(s.filled), ...turn.slots]), asked: s.asked + turn.slots.length };
    }
    return out;
  }

  test("context fixtures are valid and unique", () => {
    assert.ok(file.slot_coverage.length >= 6, "6+ slot coverage cases");
    assert.ok(file.swaps.length >= 2, "2+ swap cases");
    const ids = [...file.slot_coverage.map((c) => c.id), ...file.swaps.map((c) => c.id)];
    assert.equal(new Set(ids).size, ids.length, "ids are unique");
    for (const c of file.slot_coverage) for (const k of [...c.asks, ...(c.never ?? [])]) assert.ok(isQuestionSlot(k), `${c.id}: ${k} is a slot`);
  });

  for (const c of file.slot_coverage) {
    test(`slot coverage: ${c.id}`, () => {
      assert.equal(goalTypeOf(c.text), c.type);
      const got = asked(c.text);
      for (const k of c.asks) assert.ok(got.includes(k), `asks ${k} (asked ${got.join(", ")})`);
      for (const k of c.never ?? []) assert.ok(!got.includes(k), `never asks ${k}`);
      assert.ok(got.length <= 5, "5 questions at most");
    });
  }

  for (const s of file.swaps) {
    test(`swap: ${s.id} gives the planner two different students`, () => {
      const packs = s.profiles.map((p) =>
        rankFacts(
          p.facts.map((f, i) => ({ id: `${p.id}-${i}`, text: f.text, factCategory: f.category as never, timestamp: "2026-11-01T12:00:00Z" })),
          { purpose: "plan", query: s.goal, now },
        )
          .map(factLine)
          .join("\n"),
      );
      assert.notEqual(packs[0], packs[1]);
      s.profiles.forEach((p, i) => assert.equal(packs[i].split("\n").length, p.facts.length, `${p.id}: every fact reaches the planner`));
    });
  }

  test("gradeSwap", () => {
    const profiles = [
      { id: "a", mentions: ["cake"] },
      { id: "b", mentions: ["film"] },
    ];
    const a = [{ title: "Record a cake decorating Reel" }, { title: "Post a recipe carousel" }];
    const b = [{ title: "Shoot a film photo walk" }, { title: "Write captions for town photos" }];
    assert.equal(gradeSwap(profiles, [a, b]).pass, true);
    assert.deepEqual(gradeSwap(profiles, [a, a]).failures, ["b: mentions none of film", "plans too alike (100% shared words)"]);
    assert.deepEqual(gradeSwap(profiles, [a, []]).failures, ["b: no plan"]);
  });
});
