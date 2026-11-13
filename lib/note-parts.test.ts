import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { noteParts } from "./note-parts.ts";

test("splits labelled notes into parts", () => {
  assert.deepEqual(noteParts("GOAL: Learn the chords.\nTIME: 30 mins"), [
    { label: "Goal", text: "Learn the chords." },
    { label: "Time", text: "30 mins" },
  ]);
});

test("a lone GOAL stays prose unless asked to split", () => {
  assert.equal(noteParts("GOAL: Film 3 reels"), null);
  assert.deepEqual(noteParts("GOAL: Film 3 reels", true), [{ label: "Goal", text: "Film 3 reels" }]);
});

test("plain notes are not split", () => {
  assert.equal(noteParts("Bring the poster board", true), null);
});
