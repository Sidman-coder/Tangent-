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


type Mod = typeof import("./reveal-circle");
void (import("./reveal-circle") as Promise<Mod>).then(({ revealCircle }) => {
  test("both ends are in pixels around the same centre, so only the radius animates", () => {
    const { from, to } = revealCircle({ x: 720, y: 820 }, { width: 1440, height: 900 });
    assert.equal(from, "circle(0px at 720px 820px)");
    assert.match(to, /^circle\(\d+px at 720px 820px\)$/);
  });

  test("the circle reaches the farthest corner of the screen and no further", () => {
    // From the bottom middle of a full-screen 1440x900, the farthest corner is a top one.
    const { to } = revealCircle({ x: 720, y: 820 }, { width: 1440, height: 900 });
    assert.equal(to, `circle(${Math.ceil(Math.hypot(720, 820))}px at 720px 820px)`);
    const corner = revealCircle({ x: 0, y: 0 }, { width: 390, height: 780 });
    assert.equal(corner.to, `circle(${Math.ceil(Math.hypot(390, 780))}px at 0px 0px)`);
  });
});
