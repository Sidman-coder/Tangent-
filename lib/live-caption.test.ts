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


type Mod = typeof import("./live-caption");
void (import("./live-caption") as Promise<Mod>).then(({ liveCaption, browserCaptionAllowed }) => {
  test("the streamed transcript wins once it has words; until then the browser's guess shows", () => {
    assert.equal(liveCaption("", "finish the deck"), "finish the deck");
    assert.equal(liveCaption("finish the deck by", "finish the deck"), "finish the deck by");
    assert.equal(liveCaption("  ", ""), "");
  });

  test("the browser caption stays off on iPhone and iPad, where it can cut the recording", () => {
    assert.equal(browserCaptionAllowed({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130", maxTouchPoints: 0 }), true);
    assert.equal(browserCaptionAllowed({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 }), false);
    // iPadOS reports itself as a Mac, but has touch.
    assert.equal(browserCaptionAllowed({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605", maxTouchPoints: 5 }), false);
  });
});
