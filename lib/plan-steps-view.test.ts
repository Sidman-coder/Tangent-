// Run with `npm test`. Round 5A 2.3: Home's plan brief step cards.
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

void (import("./plan-steps-view.ts" as string) as Promise<typeof import("./plan-steps-view")>).then(({ stepCards, whenLabel, reasonLines }) => {
  test("step cards: op title and day, why from the notes, the brief fills gaps", () => {
    const cards = stepCards(
      [
        { op: "create_plan", title: "USACO Silver" },
        { op: "add_task", title: "Solve 3 Bronze prefix-sum problems", date: "2026-11-16", time: "16:30", notes: "Use the USACO guide.\nWHY: you said evenings work best\nYOU'LL HAVE: 3 solved problems" },
        { op: "add_task", title: "Review one editorial", date: "2026-11-18" },
      ],
      [
        { what: "a", when: "", why: "brief why 1", youllHave: "brief have 1" },
        { what: "b", when: "", why: "brief why 2", youllHave: "brief have 2" },
      ]
    );
    assert.equal(cards.length, 2);
    assert.deepEqual(cards[0], { index: 1, title: "Solve 3 Bronze prefix-sum problems", date: "2026-11-16", time: "16:30", why: "you said evenings work best", because: "", youllHave: "3 solved problems", ifThen: "At 4:30 PM Monday, then solve 3 Bronze prefix-sum problems." });
    assert.equal(cards[1].index, 2);
    assert.equal(cards[1].why, "brief why 2");
    assert.equal(cards[1].youllHave, "brief have 2");
  });

  test("when label: day, and a 12-hour time when there is one", () => {
    assert.equal(whenLabel("2026-11-16", "16:30"), "Mon, Nov 16 · 4:30 PM");
    assert.equal(whenLabel("2026-11-16", "00:05"), "Mon, Nov 16 · 12:05 AM");
    assert.equal(whenLabel("2026-11-16", ""), "Mon, Nov 16");
  });

  test("reasonLines drops project-template lines on an exam plan and keeps at most three (C13)", () => {
    const lines = ["Starting from the idea stage", "Standard milestones: idea, research, build, write-up, practice", "45-minute sessions", "At your open times after school", "Every section", "45-minute sessions"];
    assert.deepEqual(reasonLines(lines, "Prepare for the AP Chem final"), ["45-minute sessions", "At your open times after school", "Every section"]);
  });

  test("reasonLines keeps template lines on a real project goal (C13)", () => {
    assert.deepEqual(reasonLines(["Starting from the idea stage"], "Build a robot for the science fair"), ["Starting from the idea stage"]);
  });
});
