// Run with `npm test`. Round 5A 2.5: "Plan this" from /capture carries the talk to Home.
import * as nodeModule from "node:module";
import { describe, test } from "node:test";
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

type Mod = typeof import("./talk-handoff");

void (import("./talk-handoff") as Promise<Mod>).then(({ putTalkHandoff, takeTalkHandoff, TALK_HANDOFF_KEY }) => {

function memory() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("talk handoff", () => {
  test("the talk and goal arrive on Home once, then are gone", () => {
    const s = memory();
    putTalkHandoff({ lines: [{ role: "user", text: "help me with chem" }, { role: "assistant", text: "Here's how…" }], goal: "do well in AP Chem" }, s);
    assert.deepEqual(takeTalkHandoff(s), { lines: [{ role: "user", text: "help me with chem" }, { role: "assistant", text: "Here's how…" }], goal: "do well in AP Chem" });
    assert.equal(s.m.has(TALK_HANDOFF_KEY), false);
    assert.equal(takeTalkHandoff(s), null);
  });

  test("keeps the last 12 lines and drops bad ones", () => {
    const s = memory();
    const lines = Array.from({ length: 15 }, (_, i) => ({ role: "user" as const, text: `line ${i}` }));
    putTalkHandoff({ lines, goal: "g" }, s);
    const got = takeTalkHandoff(s)!;
    assert.equal(got.lines.length, 12);
    assert.equal(got.lines[0].text, "line 3");
    s.setItem(TALK_HANDOFF_KEY, JSON.stringify({ goal: "g", lines: [{ role: "system", text: "x" }, { role: "user", text: " " }, { role: "user", text: "ok" }] }));
    assert.deepEqual(takeTalkHandoff(s)!.lines, [{ role: "user", text: "ok" }]);
  });

  test("no goal, broken JSON or no storage: nothing to plan", () => {
    const s = memory();
    s.setItem(TALK_HANDOFF_KEY, JSON.stringify({ lines: [], goal: "  " }));
    assert.equal(takeTalkHandoff(s), null);
    s.setItem(TALK_HANDOFF_KEY, "{oops");
    assert.equal(takeTalkHandoff(s), null);
    assert.equal(takeTalkHandoff(null), null);
    assert.doesNotThrow(() => putTalkHandoff({ lines: [], goal: "g" }, null));
  });
});
});
