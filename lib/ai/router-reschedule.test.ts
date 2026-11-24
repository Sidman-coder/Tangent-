// Run with `npm test`.
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
type Mod = typeof import("./router");
void (import("./router") as Promise<Mod>).then(({ routeCommand }) => {
  // Sun 22 Nov 2026, noon in New York.
  const AT = new Date("2026-11-22T17:00:00Z");
  const TZ = "America/New_York";

  test("a move with a bare after-school hour reads it as afternoon (overnight 2 eval move-bio-review)", () => {
    assert.deepEqual(routeCommand("move bio quiz review to thursday at 5", TZ, AT), {
      op: "reschedule",
      title: "bio quiz review",
      fromDate: undefined,
      date: "2026-11-26",
      time: "17:00",
    });
  });

  test("a bare hour that could be morning stays with the model", () => {
    assert.equal(routeCommand("move bio quiz review to thursday at 8", TZ, AT), null);
    assert.equal(routeCommand("move bio quiz review to thursday at 11", TZ, AT), null);
  });

  test("existing moves still parse", () => {
    assert.deepEqual(routeCommand("move my dentist appointment to friday", TZ, AT), {
      op: "reschedule",
      title: "dentist appointment",
      fromDate: undefined,
      date: "2026-11-27",
      time: undefined,
    });
    assert.equal((routeCommand("move dentist to monday at 4pm", TZ, AT) as { time?: string }).time, "16:00");
  });
});
