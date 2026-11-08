// Run with `npm test`. Round 4, Phase 1.2–1.5: who reaches what.
//   signed out  pages go to /signin, APIs 401 (cron excepted)
//   waitlist    session kept; pages go to /waitlist, APIs 403
//   under 13    pages go to /not-yet, APIs 403
//   /dev/*      404 in production
// Plus Create account's "already have an account" rule, the age answer, and
// codes of 6 to 10 digits.
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

const INVITED = "sam@school.org";
process.env.ALLOWED_EMAILS = INVITED;

void Promise.all([import("./auth/gate"), import("./auth/signup"), import("./auth/age"), import("./auth/messages"), import("./auth/password")]).then(
  ([gateMod, { isFinishedAccount, ALREADY_HAVE_ACCOUNT }, { parseAgeAnswer, AGE_OPTIONS }, messages, { passwordRules, passwordProblem }]) => {
    const { accessOf, gate, WAITLIST_PATH, UNDER_13_PATH } = gateMod;
    type Access = Parameters<typeof gate>[0]["access"];
    const prod = (pathname: string, access: Access, search = "") => gate({ pathname, search, access, isDev: false, next: "/" });

    test("accessOf: signed out, waitlist, under 13, allowed", () => {
      assert.equal(accessOf(null), "signed_out");
      assert.equal(accessOf({ email: "stranger@else.com", app_metadata: {} }), "waitlist");
      assert.equal(accessOf({ email: INVITED, app_metadata: {} }), "allowed");
      assert.equal(accessOf({ email: INVITED.toUpperCase(), app_metadata: { provider: "google" } }), "allowed");
      // Under 13 wins over both the allowlist and the waitlist.
      assert.equal(accessOf({ email: INVITED, app_metadata: { under_13: true } }), "under13");
      assert.equal(accessOf({ email: "stranger@else.com", app_metadata: { under_13: true } }), "under13");
      // Only a real true counts.
      assert.equal(accessOf({ email: INVITED, app_metadata: { under_13: "true" } }), "allowed");
    });

    test("signed out: app pages redirect to /signin with next; APIs 401; cron passes", () => {
      for (const page of ["/", "/today", "/calendar", "/settings/security", "/waitlist", "/not-yet"]) {
        const d = prod(page, "signed_out");
        assert.equal(d.kind, "redirect", page);
        assert.ok(d.kind === "redirect" && d.to.startsWith("/signin"), page);
      }
      assert.deepEqual(prod("/calendar", "signed_out", "?d=2026-11-08"), { kind: "redirect", to: "/signin?next=%2Fcalendar%3Fd%3D2026-11-08" });
      assert.deepEqual(prod("/signin", "signed_out"), { kind: "next" });
      for (const api of ["/api/tasks", "/api/chat", "/api/age", "/api/onboarding"]) {
        const d = prod(api, "signed_out");
        assert.ok(d.kind === "json" && d.status === 401, api);
      }
      assert.deepEqual(prod("/api/cron/daily", "signed_out"), { kind: "next" });
      assert.deepEqual(prod("/auth/verify", "signed_out"), { kind: "next" });
    });

    test("waitlist: every page goes to /waitlist, every API is 403, the session is kept", () => {
      for (const page of ["/", "/today", "/signin", "/not-yet", "/invite-only"]) {
        assert.deepEqual(prod(page, "waitlist"), { kind: "redirect", to: WAITLIST_PATH }, page);
      }
      assert.deepEqual(prod(WAITLIST_PATH, "waitlist"), { kind: "next" });
      for (const api of ["/api/tasks", "/api/onboarding", "/api/age", "/api/chat"]) {
        const d = prod(api, "waitlist");
        assert.ok(d.kind === "json" && d.status === 403, api);
      }
      // Signing out still works (the /auth/ routes skip the gate).
      assert.deepEqual(prod("/auth/signout", "waitlist"), { kind: "next" });
    });

    test("under 13: every page goes to /not-yet, every API is 403", () => {
      for (const page of ["/", "/today", "/signin", "/waitlist"]) {
        assert.deepEqual(prod(page, "under13"), { kind: "redirect", to: UNDER_13_PATH }, page);
      }
      assert.deepEqual(prod(UNDER_13_PATH, "under13"), { kind: "next" });
      const d = prod("/api/tasks", "under13");
      assert.ok(d.kind === "json" && d.status === 403 && /13 and up/.test(d.error));
    });

    test("allowed: the app; /signin and the holding pages lead back in", () => {
      assert.deepEqual(prod("/today", "allowed"), { kind: "next" });
      assert.deepEqual(prod("/api/tasks", "allowed"), { kind: "next" });
      assert.deepEqual(gate({ pathname: "/signin", access: "allowed", isDev: false, next: "/calendar" }), { kind: "redirect", to: "/calendar" });
      for (const page of [WAITLIST_PATH, UNDER_13_PATH, "/invite-only"]) {
        assert.deepEqual(prod(page, "allowed"), { kind: "redirect", to: "/" }, page);
      }
    });

    test("/dev/* is 404 in production for everyone, open in development", () => {
      for (const access of ["signed_out", "waitlist", "under13", "allowed"] as Access[]) {
        assert.deepEqual(prod("/dev/app/today", access), { kind: "not_found" }, access);
        assert.deepEqual(prod("/dev", access), { kind: "not_found" }, access);
      }
      assert.deepEqual(gate({ pathname: "/dev/app/today", access: "signed_out", isDev: true }), { kind: "next" });
      // A page that merely starts with "dev" is not a preview.
      assert.equal(prod("/devices", "signed_out").kind, "redirect");
    });

    test("Create account: a finished account is told to sign in; a fresh unfinished one can carry on", () => {
      const now = Date.parse("2026-11-08T12:00:00Z");
      assert.equal(isFinishedAccount(null, now), false);
      assert.equal(isFinishedAccount({ createdAt: "2026-11-08T11:30:00Z", passwordSet: false }, now), false);
      assert.equal(isFinishedAccount({ createdAt: "2026-11-08T11:30:00Z", passwordSet: true }, now), true);
      assert.equal(isFinishedAccount({ createdAt: "2026-11-01T09:00:00Z", passwordSet: false }, now), true, "a Google account");
      assert.equal(isFinishedAccount({ createdAt: null, passwordSet: false }, now), true);
      assert.equal(ALREADY_HAVE_ACCOUNT, "You already have an account. Sign in instead.");
    });

    test("age: a neutral list; under 13 is the only thing that matters, out-of-list answers are refused", () => {
      assert.equal(AGE_OPTIONS[0].label, "7 or younger");
      assert.equal(AGE_OPTIONS[AGE_OPTIONS.length - 1].label, "19 or older");
      assert.ok(!AGE_OPTIONS.some((o) => /13|under|over/i.test(o.label) && o.value !== 13), "no hint at the cut-off");
      assert.deepEqual(parseAgeAnswer({ age: 12 }), { ok: true, under13: true });
      assert.deepEqual(parseAgeAnswer({ age: 7 }), { ok: true, under13: true });
      assert.deepEqual(parseAgeAnswer({ age: 13 }), { ok: true, under13: false });
      assert.deepEqual(parseAgeAnswer({ age: 19 }), { ok: true, under13: false });
      for (const bad of [{ age: "12" }, { age: 12.5 }, { age: 6 }, { age: 20 }, {}, null]) {
        assert.equal(parseAgeAnswer(bad).ok, false, JSON.stringify(bad));
      }
    });

    test("codes: 6 and 8 digits (any of 6–10) are accepted; pasted spacing is dropped", () => {
      const { isCodeLength, codeDigits, CODE_REJECTED, codeFailure } = messages;
      assert.equal(isCodeLength("123456"), true);
      assert.equal(isCodeLength("12345678"), true);
      assert.equal(isCodeLength("1234567890"), true);
      assert.equal(isCodeLength("12345"), false);
      assert.equal(isCodeLength("12345678901"), false);
      assert.equal(isCodeLength("1234a678"), false);
      assert.equal(codeDigits("1234 5678"), "12345678");
      assert.equal(codeDigits(" 123-456 "), "123456");
      assert.equal(codeDigits("123456789012"), "1234567890");
      assert.equal(CODE_REJECTED, "That code didn't work. Check all the digits, or send a new code.");
      assert.equal(codeFailure({ status: 403, code: "otp_expired", message: "Token has expired or is invalid" }).error, CODE_REJECTED);
    });

    test("password hints turn green one by one, and all green means the password passes", () => {
      const met = (pw: string) => passwordRules(pw, "sam@school.org").filter((r) => r.met).map((r) => r.id);
      assert.deepEqual(met(""), []);
      assert.deepEqual(met("abc"), ["common", "email"]);
      assert.deepEqual(met("password"), ["length", "email"]);
      assert.deepEqual(met("sam@school.org"), ["length", "common"]);
      assert.deepEqual(met("blue river tea"), ["length", "common", "email"]);
      for (const pw of ["", "abc", "password", "sam@school.org", "blue river tea", "x".repeat(80)]) {
        const allMet = passwordRules(pw, "sam@school.org").every((r) => r.met);
        assert.equal(allMet, passwordProblem(pw, "sam@school.org") === null, pw);
      }
    });
  }
);
