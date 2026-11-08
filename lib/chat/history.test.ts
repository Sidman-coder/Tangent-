// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { sittings } from "./history.ts";

test("sittings: a gap of over 3 hours starts a new one", () => {
  const s = sittings([
    { id: "a", at: "2026-11-08T15:00:00Z", request: "Plan my SAT prep" },
    { id: "b", at: "2026-11-08T15:05:00Z", request: "Make it lighter" },
    { id: "c", request: "no time saved" },
    { id: "d", at: "2026-11-10T19:00:00Z", request: "How am I doing?" },
  ]);
  assert.deepEqual(s.map((x) => [x.firstId, x.count]), [["a", 3], ["d", 1]]);
  assert.equal(s[0].label, "Plan my SAT prep");
  assert.deepEqual(sittings([]), []);
});
