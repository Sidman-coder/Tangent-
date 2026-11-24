// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
import * as nodeModule from "node:module";
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

type Mod = typeof import("./canvas-retry");
void (import("./canvas-retry") as Promise<Mod>).then(({ syncWithQuietRetry }) => {
const noWait = async () => {};

test("a first-try success is returned and never retried", async () => {
  let calls = 0;
  const out = await syncWithQuietRetry(async () => { calls++; return "ok"; }, { sleep: noWait });
  assert.equal(out, "ok");
  assert.equal(calls, 1);
});

test("one blip is retried quietly and the student never hears about it", async () => {
  let calls = 0;
  const out = await syncWithQuietRetry(async () => {
    calls++;
    if (calls === 1) throw new Error("Canvas took too long to respond");
    return "ok";
  }, { sleep: noWait });
  assert.equal(out, "ok");
  assert.equal(calls, 2);
});

test("two failures in a row surface the second error, after exactly two tries", async () => {
  let calls = 0;
  await assert.rejects(
    syncWithQuietRetry(async () => { calls++; throw new Error(`fail ${calls}`); }, { sleep: noWait }),
    /fail 2/,
  );
  assert.equal(calls, 2);
});

test("it waits between the tries", async () => {
  const waits: number[] = [];
  let calls = 0;
  await syncWithQuietRetry(async () => { if (++calls === 1) throw new Error("x"); return 1; }, { waitMs: 777, sleep: async (ms) => { waits.push(ms); } });
  assert.deepEqual(waits, [777]);
});
});
