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

void Promise.all([
  import("./auth/messages") as Promise<typeof import("./auth/messages")>,
  import("./auth/access") as Promise<typeof import("./auth/access")>,
]).then(([{ CODE_RATE_LIMITED, CODE_REJECTED, SEND_RATE_LIMITED, codeFailure, sendFailure }, { emailInList, normalizeEmail }]) => {
test("send: every rate limit shape reads the same", () => {
  for (const e of [{ status: 429 }, { code: "over_email_send_rate_limit" }, { message: "Email rate limit exceeded" }]) {
    assert.deepEqual(sendFailure(e), { status: 429, error: SEND_RATE_LIMITED });
  }
});

test("send: invalid email and disabled sign-in get plain words", () => {
  assert.equal(sendFailure({ code: "email_address_invalid" }).error, "Enter a valid email address.");
  assert.match(sendFailure({ code: "otp_disabled" }).error, /turned off/);
  assert.equal(sendFailure({ status: 500, message: "SMTP secret-host down" }).error, "Couldn't send the email. Try again in a moment.");
});

test("code: wrong and expired share one message; rate limit stays separate", () => {
  assert.deepEqual(codeFailure({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" }), { status: 400, error: CODE_REJECTED });
  assert.deepEqual(codeFailure({ status: 429 }), { status: 429, error: CODE_RATE_LIMITED });
});

test('a "+" alias survives normalizing and the invite check', () => {
  assert.equal(normalizeEmail(" Sam+School@Example.com "), "sam+school@example.com");
  assert.equal(emailInList("sam+school@example.com", new Set(["sam+school@example.com"])), true);
});
});
