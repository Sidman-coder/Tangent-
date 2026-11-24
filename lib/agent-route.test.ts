// Run with `npm test`. Same resolve hook as router-quick.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../${specifier.slice(2)}`, import.meta.url).href;
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

type Mod = typeof import("./agent-route");
void (import("./agent-route") as Promise<Mod>).then(({ needsAgentTools, needsDataTools }) => {
  // Overnight 2 eval: plain captures were sent to the Sonnet tool loop because
  // they contained "homework", "due" or "meeting".
  test("a capture that names homework, a due date or a meeting stays on the single call", () => {
    assert.equal(needsAgentTools("hey can you add bio homework tomorrow at 5"), false);
    assert.equal(needsAgentTools("calc test friday and english essay due monday"), false);
    assert.equal(needsAgentTools("cancel my robotics meeting"), false);
  });

  test("a lookup or a named source still gets live data", () => {
    assert.equal(needsAgentTools("what homework do I have this week"), true);
    assert.equal(needsAgentTools("what's due tomorrow?"), true);
    assert.equal(needsAgentTools("what do i have on friday"), true);
    assert.equal(needsAgentTools("add my canvas assignments"), true);
    assert.equal(needsAgentTools("check my email from coach"), true);
  });

  test("a routed task command uses data tools only for Gmail or Canvas", () => {
    assert.equal(needsDataTools("cancel the robotics meeting"), false);
    assert.equal(needsDataTools("move my homework to friday"), false);
    assert.equal(needsDataTools("add the canvas essay to friday"), true);
  });

  // Overnight 2 eval voice-email-teacher: "email" as the thing to do went to the
  // Gmail tool loop, which drafted the reminder 7 to 12 times.
  test("emailing someone is a to-do; reading email is a lookup", () => {
    assert.equal(needsAgentTools("remind me to email mister patel tomorrow morning"), false);
    assert.equal(needsDataTools("remind me to email mister patel tomorrow morning"), false);
    assert.equal(needsAgentTools("email coach about practice tonight"), false);
    assert.equal(needsAgentTools("did mister patel email me?"), true);
    assert.equal(needsAgentTools("remind me to answer the emails from coach"), true);
    assert.equal(needsAgentTools("check my email from coach"), true);
  });
});
