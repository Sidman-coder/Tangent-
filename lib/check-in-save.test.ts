// Run with `npm test`. Round 6 item 1: the check-in Save confirms or says it failed.
import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { saveCheckIn, savedLine, SAVE_FAILED } from "./check-in-save.ts";

const body = { action: "check_in" as const, taskId: "t1", feel: "nailed", time: "about" };
const respond = (ok: boolean, json: unknown) => async () => ({ ok, json: async () => json });

test("check-in save: success shows Saved and the next step", async () => {
  let sent = "";
  const result = await saveCheckIn(async (_url, init) => {
    sent = init.body;
    return { ok: true, json: async () => ({ ok: true, reply: null }) };
  }, body);
  assert.deepEqual(result, { status: "saved", reply: null });
  assert.equal(JSON.parse(sent).taskId, "t1");
  assert.equal(savedLine("Wire the motor · Tue 7:30 PM"), "Saved. Next: Wire the motor · Tue 7:30 PM");
  assert.equal(savedLine(null), "Saved.");
});

test("check-in save: Tangent's reply comes back with the save", async () => {
  const result = await saveCheckIn(respond(true, { ok: true, reply: "That sounds like a lot." }), body);
  assert.deepEqual(result, { status: "saved", reply: "That sounds like a lot." });
});

test("check-in save: a server error, ok:false or no network is a failure", async () => {
  assert.deepEqual(await saveCheckIn(respond(false, { error: "nope" }), body), { status: "failed" });
  assert.deepEqual(await saveCheckIn(respond(true, { ok: false }), body), { status: "failed" });
  assert.deepEqual(
    await saveCheckIn(async () => {
      throw new TypeError("Failed to fetch");
    }, body),
    { status: "failed" },
  );
  assert.equal(SAVE_FAILED, "That didn't save. Try again.");
});

test("check-in save: a 200 with an unreadable body still counts as saved", async () => {
  // The server wrote the row; only the reply text is lost.
  assert.deepEqual(await saveCheckIn(respond(true, "not json"), body), { status: "saved", reply: null });
});
