// Run with `npm test`. Sign-in (master fix, Phase 1B): the invite allowlist
// match (case, whitespace, +aliases), the redirect origin for sign-in emails,
// the `next` guard, and which browser keys a full sign-out clears.
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

type Access = typeof import("./auth/access");
type Redirect = typeof import("./auth/redirect");
type Clear = typeof import("./auth/clear-local");

void Promise.all([
  import("./auth/access") as Promise<Access>,
  import("./auth/redirect") as Promise<Redirect>,
  import("./auth/clear-local") as Promise<Clear>,
]).then(([{ emailInList, isEmailAllowed, normalizeEmail }, { requestOrigin, authCallbackUrl }, { isTangentKey }]) => {
  const withAllowed = <T>(raw: string | undefined, fn: () => T): T => {
    const saved = process.env.ALLOWED_EMAILS;
    if (raw === undefined) delete process.env.ALLOWED_EMAILS;
    else process.env.ALLOWED_EMAILS = raw;
    try {
      return fn();
    } finally {
      if (saved === undefined) delete process.env.ALLOWED_EMAILS;
      else process.env.ALLOWED_EMAILS = saved;
    }
  };

  test("allowlist ignores case and surrounding whitespace", () => {
    withAllowed(" Student@School.org ,friend@gmail.com", () => {
      assert.equal(isEmailAllowed("student@school.org"), true);
      assert.equal(isEmailAllowed("  STUDENT@school.ORG  "), true);
      assert.equal(isEmailAllowed("friend@gmail.com"), true);
      assert.equal(isEmailAllowed("stranger@gmail.com"), false);
    });
  });

  test("allowlist accepts commas, semicolons, spaces and newlines between emails", () => {
    withAllowed("a@x.com; b@x.com\nc@x.com d@x.com", () => {
      for (const e of ["a@x.com", "b@x.com", "c@x.com", "d@x.com"]) assert.equal(isEmailAllowed(e), true, e);
    });
  });

  test("+aliases of an invited email are let in; an invited alias doesn't admit the base", () => {
    const allowed = new Set(["student@school.org", "eval+tangent@gmail.com"]);
    assert.equal(emailInList("student+tangent@school.org", allowed), true);
    assert.equal(emailInList("Student+Test@School.org", allowed), true);
    assert.equal(emailInList("eval+tangent@gmail.com", allowed), true);
    assert.equal(emailInList("eval@gmail.com", allowed), false);
    assert.equal(emailInList("eval+other@gmail.com", allowed), false);
  });

  test("a '+' decoded to a space (form or URL encoding) still matches", () => {
    assert.equal(normalizeEmail("eval tangent@gmail.com"), "eval+tangent@gmail.com");
    assert.equal(emailInList("eval tangent@gmail.com", new Set(["eval+tangent@gmail.com"])), true);
  });

  test("empty, malformed and missing allowlists let nobody in", () => {
    assert.equal(emailInList("", new Set(["a@x.com"])), false);
    assert.equal(emailInList("not-an-email", new Set(["not-an-email"])), false);
    assert.equal(emailInList(null as unknown as string, new Set(["a@x.com"])), false);
    const warn = console.warn;
    console.warn = () => {};
    try {
      withAllowed("", () => assert.equal(isEmailAllowed("a@x.com"), false));
      withAllowed(undefined, () => assert.equal(isEmailAllowed("a@x.com"), false));
    } finally {
      console.warn = warn;
    }
  });

  test("sign-in redirect uses the origin the student is on", () => {
    // Local dev.
    assert.equal(requestOrigin({ origin: "http://localhost:3000", host: "localhost:3000" }, "http://localhost:3000/auth/magic-link"), "http://localhost:3000");
    // A Vercel preview behind the proxy.
    assert.equal(
      requestOrigin(
        { origin: "https://tangent-git-x.vercel.app", host: "internal:3000", forwardedHost: "tangent-git-x.vercel.app", forwardedProto: "https" },
        "http://internal:3000/auth/magic-link"
      ),
      "https://tangent-git-x.vercel.app"
    );
    // No Origin header: the proxied host and protocol.
    assert.equal(requestOrigin({ host: "internal", forwardedHost: "app.example.com", forwardedProto: "https" }, "http://internal/x"), "https://app.example.com");
    // A cross-site Origin can't choose where the email link points.
    assert.equal(requestOrigin({ origin: "https://evil.example", host: "app.example.com", forwardedProto: "https" }, "https://app.example.com/x"), "https://app.example.com");
    // Nothing but the request URL.
    assert.equal(requestOrigin({}, "https://app.example.com/auth/magic-link"), "https://app.example.com");
  });

  test("callback URL keeps a safe next and always has a query string", () => {
    assert.equal(authCallbackUrl("https://app.example.com/", "/calendar?view=week"), "https://app.example.com/auth/callback?next=%2Fcalendar%3Fview%3Dweek");
    assert.equal(authCallbackUrl("http://localhost:3000", "//evil.example"), "http://localhost:3000/auth/callback?next=%2F");
    assert.equal(authCallbackUrl("http://localhost:3000", null), "http://localhost:3000/auth/callback?next=%2F");
  });

  test("full sign-out clears Tangent keys but keeps the theme", () => {
    for (const k of ["tangent:ai:activeSessionId", "tangent-short-titles-v2", "tangent-cal-view", "tangent-tour-done"]) assert.equal(isTangentKey(k), true, k);
    assert.equal(isTangentKey("tangent-theme"), false);
    assert.equal(isTangentKey("other-app"), false);
  });
});
