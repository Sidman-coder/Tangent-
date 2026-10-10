// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../../${specifier.slice(2)}`, import.meta.url).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

type Router = typeof import("./router");
void (import("./router") as Promise<Router>).then(({ quickCapture }) => {
  const tz = "America/New_York";
  const at = new Date("2026-10-10T16:00:00-04:00"); // Saturday afternoon

  test("plain to-dos are captured without the model", () => {
    assert.deepEqual(quickCapture("read english chapter 6", tz, at), { title: "Read english chapter 6", date: undefined, time: undefined, deadline: undefined });
    assert.equal(quickCapture("remind me to email ms. lee", tz, at)?.title, "Email ms. lee");
    assert.deepEqual(quickCapture("dentist tomorrow at 3pm", tz, at), { title: "Dentist", date: "2026-10-11", time: "15:00", deadline: undefined });
  });

  test("a due clause becomes a deadline, not the day it happens", () => {
    const c = quickCapture("chem lab report due friday", tz, at);
    assert.equal(c?.title, "Chem lab report");
    assert.equal(c?.deadline, "2026-10-16");
    assert.equal(c?.date, undefined);
  });

  test("commands, questions, plans and lists go to the model", () => {
    for (const s of [
      "what's due this week",
      "move chem to friday at 4pm",
      "mark essay done",
      "make me a plan for finals",
      "soccer every tuesday",
      "buy milk, eggs, bread",
      "is my essay due friday?",
      "help me get better at chess",
      "clear my schedule",
    ]) {
      assert.equal(quickCapture(s, tz, at), null, s);
    }
  });
});
