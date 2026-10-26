// Run with `npm test`. Same resolve hook as ics.test.ts.
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


type Mod = typeof import("./hold-gesture");
void (import("./hold-gesture") as Promise<Mod>).then(({ holdReducer, initialHold, HOLD_MS }) => {
  // Feed events in order; return every effect and the final state.
  const run = (events: Parameters<typeof holdReducer>[1][], start = initialHold) => {
    let s = start;
    const effects: string[] = [];
    for (const e of events) {
      const r = holdReducer(s, e);
      s = r.next;
      if (r.effect !== "none") effects.push(r.effect);
    }
    return { state: s.state, effects };
  };

  test("a quick tap opens typing", () => {
    assert.deepEqual(run([{ type: "down", t: 0, y: 500 }, { type: "up", t: 120, y: 500 }]), { state: "idle", effects: ["open-typing"] });
  });

  test("holding past HOLD_MS starts listening and letting go sends", () => {
    const r = run([{ type: "down", t: 0, y: 500 }, { type: "tick", t: HOLD_MS + 10 }, { type: "up", t: 900, y: 500 }]);
    assert.deepEqual(r, { state: "sorting", effects: ["start-listening", "send"] });
  });

  test("a tick before HOLD_MS does nothing", () => {
    assert.deepEqual(run([{ type: "down", t: 0, y: 500 }, { type: "tick", t: HOLD_MS - 50 }]), { state: "pressed", effects: [] });
  });

  test("dragging up past the threshold before letting go cancels", () => {
    const r = run([{ type: "down", t: 0, y: 500 }, { type: "tick", t: 300 }, { type: "up", t: 900, y: 450 }]);
    assert.deepEqual(r, { state: "idle", effects: ["start-listening", "abort"] });
  });

  test("a cancel (scroll, blur, lost capture) while listening aborts", () => {
    const r = run([{ type: "down", t: 0, y: 500 }, { type: "tick", t: 300 }, { type: "cancel" }]);
    assert.deepEqual(r, { state: "idle", effects: ["start-listening", "abort"] });
  });

  test("a cancel while only pressed aborts quietly back to idle", () => {
    assert.deepEqual(run([{ type: "down", t: 0, y: 500 }, { type: "cancel" }]), { state: "idle", effects: ["abort"] });
  });

  test("nothing starts while a capture is still sorting", () => {
    const sorting = { state: "sorting" as const, downT: 0, downY: 0 };
    assert.deepEqual(run([{ type: "down", t: 0, y: 500 }, { type: "tick", t: 999 }, { type: "up", t: 1000, y: 500 }], sorting), { state: "sorting", effects: [] });
    assert.deepEqual(run([{ type: "sorted" }], sorting), { state: "idle", effects: [] });
  });

  test("tap-to-stop: a listen started without a press sends on the next tap", () => {
    const listening = { state: "listening" as const, downT: -1, downY: 0 };
    assert.deepEqual(run([{ type: "down", t: 0, y: 500 }, { type: "up", t: 80, y: 500 }], listening), { state: "sorting", effects: ["send"] });
  });
});
