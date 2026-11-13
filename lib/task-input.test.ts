// Run with `npm test`. Round 4 Phase 1.1: /api/tasks used to send values
// Postgres rejects straight to the insert (500) and returned the raw error.
// These cover the field checks that now return 400, and the log summary that
// keeps personal data out of server logs.
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

void Promise.all([import("./task-input"), import("./server-log")]).then(
  ([{ isValidYmd, isValidTime, normalizeTime, taskFieldError }, { redactMessage, safeErrorSummary }]) => {
    test("dates: only real YYYY-MM-DD dates pass", () => {
      assert.equal(isValidYmd("2026-11-08"), true);
      assert.equal(isValidYmd("2028-02-29"), true);
      for (const bad of ["", "2026-11-8", "2026-02-30", "2026-13-01", "tomorrow", null, 20261108]) {
        assert.equal(isValidYmd(bad), false, String(bad));
      }
    });

    test("times: HH:MM or empty; seconds are trimmed", () => {
      for (const ok of ["", "00:00", "09:30", "23:59", "14:05:00"]) assert.equal(isValidTime(ok), true, ok);
      for (const bad of ["9:00", "24:00", "12:60", "9am", null, 900]) assert.equal(isValidTime(bad), false, String(bad));
      assert.equal(normalizeTime("14:05:00"), "14:05");
      assert.equal(normalizeTime(""), "");
    });

    test("taskFieldError: the values that used to reach Postgres and 500", () => {
      assert.equal(taskFieldError({ date: "" }), "date must be YYYY-MM-DD");
      assert.equal(taskFieldError({ date: "2026-02-30" }), "date must be YYYY-MM-DD");
      assert.equal(taskFieldError({ time: "7pm" }), "time must be HH:MM");
      assert.equal(taskFieldError({ title: 42 }), "title must be text");
      assert.equal(taskFieldError({ completed: "yes" }), "completed must be true or false");
      assert.equal(taskFieldError({ endDate: "soon" }), "endDate must be YYYY-MM-DD");
    });

    test("taskFieldError: missing fields and null time are fine", () => {
      assert.equal(taskFieldError({}), null);
      assert.equal(taskFieldError({ time: null }), null);
      assert.equal(taskFieldError({ title: "Essay draft", date: "2026-11-09", time: "16:00", completed: true }), null);
    });

    test("log summary keeps code and status, drops quoted values and emails", () => {
      const err = Object.assign(new Error('[store] addTask: invalid input syntax for type date: "my secret essay"'), { code: "22007" });
      const s = safeErrorSummary(err);
      assert.equal(s.code, "22007");
      assert.ok(!s.message.includes("secret"));
      assert.ok(s.message.includes("invalid input syntax for type date"));

      const auth = safeErrorSummary({ name: "AuthApiError", message: "Email rate limit exceeded for student@school.org", status: 429, code: "over_email_send_rate_limit" });
      assert.equal(auth.status, 429);
      assert.equal(auth.code, "over_email_send_rate_limit");
      assert.ok(!auth.message.includes("student@school.org"));
      assert.equal(redactMessage("x".repeat(1000)).length, 300);
    });
  }
);
