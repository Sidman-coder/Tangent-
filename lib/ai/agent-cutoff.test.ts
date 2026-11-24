import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./agent-cutoff");

void (import("./agent-cutoff.ts" as string) as Promise<Mod>).then(({ afterAgentTurn, fitToolResult, AGENT_RETRY_BUDGET_MS, AGENT_CUTOFF_REPLY }) => {
  test("overnight 2 (Priya sim): a turn cut off at the token cap is retried once, in time", () => {
    assert.equal(afterAgentTurn("tool_use", false, 1000), "ok");
    assert.equal(afterAgentTurn("end_turn", false, 1000), "ok");
    assert.equal(afterAgentTurn("max_tokens", false, 6000), "retry");
    assert.equal(afterAgentTurn("max_tokens", true, 6000), "give_up", "only one retry");
    assert.equal(afterAgentTurn("max_tokens", false, AGENT_RETRY_BUDGET_MS), "give_up", "no time left inside the route's 60 s");
  });

  test("the give-up reply says nothing was added, and how to get unstuck", () => {
    assert.match(AGENT_CUTOFF_REPLY, /nothing was added/);
    assert.match(AGENT_CUTOFF_REPLY, /first week/);
  });

  test("a long tool result is cut with a note, a short one untouched", () => {
    assert.equal(fitToolResult('{"a":1}'), '{"a":1}');
    const long = JSON.stringify({ tasks: Array.from({ length: 400 }, (_, i) => ({ id: i, title: `Task ${i}` })) });
    const cut = fitToolResult(long, 500);
    assert.equal(cut.length, 500);
    assert.match(cut, /cut to fit/);
  });
});
