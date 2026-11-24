// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
import * as nodeModule from "node:module";
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

import type { Task } from "./types";
type Gates = typeof import("./first-run-gates");
void (import("./first-run-gates") as Promise<Gates>).then(({ claimOverlay, hasFirstRealItem, overlayHolder, releaseOverlay, resetOverlayGate }) => {
  const base: Task = { id: "1", title: "AP Chem exam", date: "2026-12-04", time: "09:00", completed: false };

  test("hasFirstRealItem: nothing, or only Canvas and the School block, is not a first item", () => {
    assert.equal(hasFirstRealItem(null), false);
    assert.equal(hasFirstRealItem([]), false);
    const canvas: Task = { ...base, id: "c", source: "canvas" };
    const school: Task = { ...base, id: "s", title: "School", kind: "school", recurring: { enabled: true, frequency: "weekly", parentId: "p1" } };
    assert.equal(hasFirstRealItem([canvas, school]), false);
  });

  test("hasFirstRealItem: one student-made item counts", () => {
    assert.equal(hasFirstRealItem([base]), true);
  });

  test("overlay gate: only one holder at a time, and release hands it on", () => {
    resetOverlayGate();
    assert.equal(claimOverlay("tour"), true);
    assert.equal(claimOverlay("notifs"), false);
    assert.equal(overlayHolder(), "tour");
    assert.equal(claimOverlay("tour"), true, "the holder may claim again");
    releaseOverlay("notifs");
    assert.equal(overlayHolder(), "tour", "a non-holder cannot release");
    releaseOverlay("tour");
    assert.equal(overlayHolder(), null);
    assert.equal(claimOverlay("notifs"), true);
    resetOverlayGate();
  });
});
