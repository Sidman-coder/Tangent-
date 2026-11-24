// Run with `npm test`. Same resolve hook as capture-outcome.test.ts.
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

type Mod = typeof import("./friendly-error");
void (import("./friendly-error") as Promise<Mod>).then(({ friendlyError, friendlyMessage, MIC_DENIED_MESSAGE, OFFLINE_MESSAGE }) => {
  test("browser network errors become a plain offline line", () => {
    for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource.", "Network request failed"]) {
      assert.equal(friendlyMessage(m), OFFLINE_MESSAGE, m);
    }
    assert.equal(friendlyError(new TypeError("Failed to fetch"), "x"), OFFLINE_MESSAGE);
  });

  test("a denied microphone becomes a plain line that says what to do", () => {
    for (const m of ["Permission denied", "NotAllowedError", "Microphone access denied", "Permission dismissed"]) {
      assert.equal(friendlyMessage(m), MIC_DENIED_MESSAGE, m);
    }
  });

  test("a leaked upstream error never reaches the chat reply", async () => {
    const { serverFailureMessage, SERVER_FAILURE_MESSAGE } = (await import("./friendly-error")) as Mod;
    const leaks = [
      'Anthropic error: 400 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}',
      "Anthropic error 529",
      "Request failed with status 502",
      "Cannot read properties of undefined",
      "",
      "x".repeat(200),
    ];
    for (const l of leaks) assert.equal(serverFailureMessage(l), SERVER_FAILURE_MESSAGE, l.slice(0, 40));
    assert.equal(serverFailureMessage("That date is in the past."), "I couldn't do that — That date is in the past.");
  });

  test("server messages written for students pass through; empty uses the fallback", () => {
    assert.equal(friendlyMessage("That date is in the past."), "That date is in the past.");
    assert.equal(friendlyError(new Error(""), "Something went wrong."), "Something went wrong.");
    assert.equal(friendlyError(undefined, "Couldn't load."), "Couldn't load.");
  });
});
