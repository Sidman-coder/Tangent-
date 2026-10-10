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

void (import("./ask-route") as Promise<typeof import("./ask-route")>).then(({ routeAsk }) => {
  test("plain to-dos and commands are done", () => {
    for (const s of ["read english chapter 6", "dentist tomorrow at 3pm", "move chem to friday", "what's due this week", "mark essay done", "can you add soccer every tuesday"]) {
      assert.equal(routeAsk(s), "do", s);
    }
  });
  test("questions are talked through", () => {
    for (const s of ["how should I study for a calc test?", "is it worth doing debate and robotics", "explain how spaced repetition works", "what should I focus on this week"]) {
      assert.equal(routeAsk(s), "question", s);
    }
  });
  test("multi-week efforts become projects", () => {
    for (const s of ["prep for my chem final", "science fair project", "start a robotics club", "study for the SAT over the next 6 weeks"]) {
      assert.equal(routeAsk(s), "project", s);
    }
  });
  test("long-range goals become Tangents", () => {
    for (const s of ["get into georgia tech", "reach 1800 chess rating", "become a software engineer", "get a 1500 sat score"]) {
      assert.equal(routeAsk(s), "goal", s);
    }
  });
});
