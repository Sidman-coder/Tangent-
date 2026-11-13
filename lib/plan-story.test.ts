// Run with `npm test`.
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

void (import("./plan-story") as Promise<typeof import("./plan-story")>).then(({ planStory, planStoryText }) => {
  test("a new project's round 1 names the project, the span and the first steps", () => {
    const s = planStory({
      summary: "Planned round 1 of your Instagram growth",
      assumptions: ["you film after school"],
      ops: [
        { op: "create_plan", ref: "p1", title: "Instagram Growth to 10K" },
        { op: "add_task", title: "Pick 3 reel ideas", date: "2026-11-12", plan_ref: "p1" },
        { op: "add_task", title: "Film reel 1", date: "2026-11-10", plan_ref: "p1" },
        { op: "add_task", title: "Post reel 1", date: "2026-11-14", plan_ref: "p1" },
      ],
    });
    assert.equal(s.lead, "Planned round 1 of your Instagram growth.");
    assert.equal(s.lines[0], "Round 1 for Instagram Growth to 10K: 3 steps, Tue, Nov 10 to Sat, Nov 14.");
    assert.match(s.lines[1], /^Starting with Pick 3 reel ideas, Film reel 1, Post reel 1\.$/);
    assert.ok(s.lines.includes("Assumed: you film after school"));
    assert.match(s.lines[s.lines.length - 1], /until you add it/);
  });

  test("one task on one day, in an existing project", () => {
    const text = planStoryText(
      { summary: "Add Film reel.", assumptions: [], ops: [{ op: "add_task", title: "Film reel", date: "2026-11-10", plan_id: "p" }] },
      "Instagram Growth to 10K"
    );
    assert.match(text, /^Add Film reel\.\nMore for Instagram Growth to 10K: 1 step, on Tue, Nov 10\./);
  });

  test("moves and removals are counted", () => {
    const s = planStory({ summary: "Moved chem", assumptions: [], ops: [{ op: "move_task", task_id: "t", date: "2026-11-11" }, { op: "delete_task", task_id: "u" }] });
    assert.deepEqual(s.lines.slice(0, 2), ["1 change to what's already planned.", "1 step removed."]);
  });
});
