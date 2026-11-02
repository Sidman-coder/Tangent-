// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
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

type Match = typeof import("./project-match");
void (import("./project-match") as Promise<Match>).then(({ matchProject }) => {

const projects = [
  { id: "a", title: "Launching a School Robotics Team" },
  { id: "b", title: "Tangent Pen Electrical Troubleshooting" },
  { id: "c", title: "AP Chem Final Prep" },
];

test("matches the same effort worded differently", () => {
  assert.equal(matchProject("start a robotics club at school", projects)?.id, "a");
  assert.equal(matchProject("fix the pen's electrical issues", projects)?.id, "b");
  assert.equal(matchProject("more prep for the chem final", projects)?.id, "c");
});

test("leaves unrelated asks alone", () => {
  assert.equal(matchProject("start a debate club", projects), null);
  assert.equal(matchProject("plan my week", projects), null);
  assert.equal(matchProject("study for my chem quiz", projects), null);
});

});
