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

const tangent = { title: "Georgia Tech", target: "admitted for Fall 2027", hoursPerWeek: 4 };

void (import("./tangent-start") as Promise<typeof import("./tangent-start")>).then(({ startIdeaMessage, startsPlanning }) => {
  test("a kept move becomes a planning request with what the Tangent knows", () => {
    const msg = startIdeaMessage(
      { title: "Start a robotics club", detail: "Lead a small team at school.\n\nFirst step: Ask Ms. Lee to sponsor it", rationale: "Shows leadership" },
      tangent,
    );
    assert.ok(msg.startsWith("Plan: Start a robotics club."));
    assert.match(msg, /Georgia Tech Tangent, toward admitted for Fall 2027\./);
    assert.match(msg, /First step: Ask Ms\. Lee to sponsor it\./);
    assert.match(msg, /about 4 hours a week/);
    assert.ok(startsPlanning(msg));
  });

  test("it stays short enough for Home to plan from", () => {
    const long = "x".repeat(400);
    const msg = startIdeaMessage({ title: "Build an app", detail: long, rationale: long, effort: long }, tangent);
    assert.ok(msg.length <= 560);
    assert.ok(msg.startsWith("Plan: Build an app."));
    assert.ok(startsPlanning(msg));
  });

  test("no detail: just the move and its Tangent", () => {
    assert.equal(
      startIdeaMessage({ title: "Volunteer at the library!" }, { title: "Community" }),
      "Plan: Volunteer at the library. It's a move in my Community Tangent.",
    );
  });
});
