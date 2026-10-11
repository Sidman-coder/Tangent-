// Run with `npm test`. route-request imports lib/ai/router, which imports
// "@/lib/time"; the resolve hook maps "@/" to the project root and adds ".ts".
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(ROOT, s.slice(2))).href;
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

type Mod = typeof import("./route-request");

void (import("./route-request") as Promise<Mod>).then(({ routeRequest, normalizeRequest, hasActionWords }) => {
  const TZ = "America/New_York";
  const AT = new Date("2026-10-06T14:00:00Z");
  const route = (t: string) => routeRequest(t, TZ, AT);

  test("required: an add phrased as a question is never chat", () => {
    assert.notEqual(route("can you add dentist tomorrow?"), "chat");
    assert.ok(["fast", "draft"].includes(route("can you add dentist tomorrow?")));
  });

  test("required: what's my plan for today? is chat", () => {
    assert.equal(route("what's my plan for today?"), "chat");
  });

  test("required: should I schedule study time for the SAT? is draft", () => {
    assert.equal(route("should I schedule study time for the SAT?"), "draft");
  });

  test("required: ideas for my ICF project is chat", () => {
    assert.equal(route("ideas for my ICF project"), "chat");
  });

  test("plain commands draft or go fast", () => {
    assert.notEqual(route("add dentist tomorrow at 3pm"), "chat");
    assert.equal(route("help me plan ICF prep for the next two weeks"), "draft");
    assert.equal(route("move my essay to friday"), route("move my essay to friday") === "fast" ? "fast" : "draft");
  });

  test("questions and brainstorms without action words are chat", () => {
    assert.equal(route("how should I study for chemistry?"), "chat");
    assert.equal(route("what does ICF stand for"), "chat");
    assert.equal(route("brainstorm topics for my essay"), "chat");
  });

  test("unclear text drafts (preview first)", () => {
    assert.equal(route("ICF prep"), "draft");
    assert.equal(route(""), "draft");
  });

  test("voice-style: filler, no punctuation, lowercase", () => {
    assert.equal(route("um can you like help me plan icf prep"), "draft");
    assert.equal(route("uh what should i do for icf"), "chat");
    assert.notEqual(route("add dentist um tomorrow at 3"), "chat");
  });

  test("normalizeRequest strips leading filler", () => {
    assert.equal(normalizeRequest("  Um, so   Hey TANGENT what's up "), "what's up");
  });

  test("plan and schedule count only as verbs", () => {
    assert.equal(hasActionWords("what's my plan"), false);
    assert.equal(hasActionWords("what's on the schedule"), false);
    assert.equal(hasActionWords("can you plan my week"), true);
  });
});
