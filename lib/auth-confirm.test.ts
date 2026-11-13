// Run with `npm test`. Round 5A, 1.1: when the confirm-password box may complain.
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

type Mod = typeof import("./auth/confirm-state");
type ConfirmState = import("./auth/confirm-state").ConfirmState;
type ConfirmEvent = import("./auth/confirm-state").ConfirmEvent;

void import("./auth/confirm-state").then((m: Mod) => {
const { PASSWORD_MISMATCH, confirmReducer, confirmView, initialConfirmState, isMismatchProblem } = m;

// Drives the helper the way the field does: an event, then the current values.
function field() {
  let state: ConfirmState = initialConfirmState;
  let password = "";
  let confirm = "";
  return {
    send(event: ConfirmEvent) {
      state = confirmReducer(state, event);
    },
    typePassword(v: string) {
      password = v;
      state = confirmReducer(state, "editPassword");
    },
    typeConfirm(v: string) {
      confirm = v;
      state = confirmReducer(state, "editConfirm");
    },
    view: () => confirmView(password, confirm, state),
  };
}

test("confirm: wrong → blur (error) → edit (no error) → match (green) → change (no error until blur)", () => {
  const f = field();
  f.typePassword("correct horse 42");

  f.typeConfirm("correct hor");
  assert.equal(f.view(), "idle", "no error while still typing");

  f.send("blur");
  assert.equal(f.view(), "mismatch", "error after leaving the box");

  f.typeConfirm("correct horse 4");
  assert.equal(f.view(), "idle", "error hides as soon as the confirm box is edited");

  f.typeConfirm("correct horse 42");
  assert.equal(f.view(), "match", "green once they match");

  f.typePassword("correct horse 43");
  assert.equal(f.view(), "idle", "changing the password hides the match, no error yet");

  f.send("blur");
  assert.equal(f.view(), "mismatch", "error returns on the next blur");
});

test("confirm: never shows a mismatch before blur or submit", () => {
  const f = field();
  f.typePassword("abcdefghijkl1");
  for (const v of ["a", "ab", "abc", "abcd"]) {
    f.typeConfirm(v);
    assert.equal(f.view(), "idle");
  }
});

test("confirm: tabbing through an empty box is not an error, submitting one is", () => {
  const f = field();
  f.typePassword("abcdefghijkl1");
  f.send("blur");
  assert.equal(f.view(), "idle");
  f.send("submit");
  assert.equal(f.view(), "mismatch");
  f.typeConfirm("a");
  assert.equal(f.view(), "idle", "an edit hides the submit error too");
});

test("confirm: two empty boxes show nothing", () => {
  const f = field();
  f.send("blur");
  f.send("submit");
  assert.equal(f.view(), "idle");
});

test("confirm: the form-level mismatch text is recognised so it isn't shown twice", () => {
  assert.equal(isMismatchProblem(PASSWORD_MISMATCH), true);
  assert.equal(isMismatchProblem("Use at least 12 characters."), false);
  assert.equal(isMismatchProblem(null), false);
});
});
