// Run with `npm test`. Optional password sign-in: the invite list on every
// path, one answer for a wrong password whether or not the account exists,
// the skip and forgot-password paths, the 5-per-15-minutes limiter, and the
// rules a new password must pass.
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

type Password = typeof import("./auth/password");
type Flow = typeof import("./auth/password-flow");
type Clear = typeof import("./auth/clear-local");
type SignInDeps = import("./auth/password-flow").SignInDeps;

const INVITED = "sam@school.org";
const OTHER = "pat@school.org";

void Promise.all([
  import("./auth/password") as Promise<Password>,
  import("./auth/password-flow") as Promise<Flow>,
  import("./auth/clear-local") as Promise<Clear>,
]).then(([pw, flow, { isTangentKey }]) => {
  const {
    AttemptLimiter,
    COMMON_PASSWORDS,
    NO_PASSWORD_YET,
    TOO_MANY_PASSWORD_TRIES,
    WRONG_PASSWORD,
    amrFromAccessToken,
    passwordProblem,
    passwordStrength,
    signedInByEmailCodeRecently,
  } = pw;
  const { passwordSignIn, setPassword, PROOF_NEEDED } = flow;

  process.env.ALLOWED_EMAILS = `${INVITED}, ${OTHER}`;

  // A fake Supabase: `accounts` maps email -> password (null = no password).
  const signInDeps = (accounts: Record<string, string | null>, calls: string[] = []): SignInDeps => ({
    async signIn(email: string, password: string) {
      calls.push(`signIn:${email}`);
      const stored = accounts[email];
      if (typeof stored === "string" && stored === password) {
        return { user: { id: `id-${email}`, email, app_metadata: { password_set: true } }, error: null };
      }
      return { user: null, error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials" } };
    },
    async hasPassword(email: string) {
      calls.push(`hasPassword:${email}`);
      return typeof accounts[email] === "string";
    },
    async signOut() {
      calls.push("signOut");
    },
    async markPasswordSet(id: string) {
      calls.push(`mark:${id}`);
    },
  });
  const signIn = (email: string, password: string, deps: SignInDeps, limiter = new AttemptLimiter(), ip: string | null = "1.1.1.1", now = 0) =>
    passwordSignIn({ email, password, next: "/calendar", ip }, deps, limiter, now);

  test("password sign-in: right password signs in and returns next", async () => {
    const r = await signIn(INVITED, "correct horse", signInDeps({ [INVITED]: "correct horse" }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, next: "/calendar" });
  });

  test("allowlist on every path: password sign-in refuses an uninvited email before Supabase", async () => {
    const calls: string[] = [];
    const r = await signIn("stranger@else.com", "anything123", signInDeps({ "stranger@else.com": "anything123" }, calls));
    assert.equal(r.status, 403);
    assert.equal(r.body.notInvited, true);
    assert.deepEqual(calls, [], "Supabase is never asked");
  });

  test("allowlist on every path: setting a password needs an invited session", async () => {
    const r = await setPassword(
      { password: "a long passphrase", ip: null },
      setDeps({ email: "stranger@else.com", fresh: true }),
      new AttemptLimiter()
    );
    assert.equal(r.status, 403);
    assert.equal(r.body.notInvited, true);
  });

  test("allowlist on every path: a signed-in user dropped from the list is signed out", async () => {
    const calls: string[] = [];
    const deps = signInDeps({ [INVITED]: "correct horse" }, calls);
    deps.signIn = async () => ({ user: { id: "x", email: "someone@removed.org", app_metadata: {} }, error: null });
    const r = await signIn(INVITED, "correct horse", deps);
    assert.equal(r.status, 403);
    assert.equal(r.body.next, "/invite-only");
    assert.ok(calls.includes("signOut"));
  });

  test("a wrong password never says whether the account exists", async () => {
    // INVITED has a password; OTHER (also invited) has no account at all.
    const deps = signInDeps({ [INVITED]: "correct horse" });
    const wrong = await signIn(INVITED, "wrong guess 1", deps);
    assert.equal(wrong.body.error, WRONG_PASSWORD);
    // No account and an account without a password read exactly the same.
    const noAccount = await signIn(OTHER, "wrong guess 1", signInDeps({}));
    const noPassword = await signIn(OTHER, "wrong guess 1", signInDeps({ [OTHER]: null }));
    assert.deepEqual(noAccount, noPassword);
    assert.equal(noAccount.body.error, NO_PASSWORD_YET);
    assert.equal(wrong.status, noAccount.status);
    // The message itself names neither the email nor the password as the problem.
    assert.equal(WRONG_PASSWORD, "Wrong email or password.");
  });

  test("a failed account lookup falls back to the generic wrong-password message", async () => {
    const deps = signInDeps({});
    deps.hasPassword = async () => {
      throw new Error("down");
    };
    const r = await signIn(INVITED, "whatever123", deps);
    assert.equal(r.body.error, WRONG_PASSWORD);
  });

  test("rate limit: the 6th failure for one email in 15 minutes is refused before Supabase", async () => {
    const limiter = new AttemptLimiter();
    const calls: string[] = [];
    const deps = signInDeps({ [INVITED]: "correct horse" }, calls);
    for (let i = 0; i < 5; i++) {
      const r = await signIn(INVITED, `wrong ${i}xxxx`, deps, limiter, `10.0.0.${i}`, i * 1000);
      assert.equal(r.status, 400);
    }
    calls.length = 0;
    const blocked = await signIn(INVITED, "correct horse", deps, limiter, "10.0.0.99", 6000);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, TOO_MANY_PASSWORD_TRIES);
    assert.deepEqual(calls, [], "even the right password waits");
    // After 15 minutes the window has passed.
    const later = await signIn(INVITED, "correct horse", deps, limiter, "10.0.0.99", 15 * 60 * 1000 + 5000);
    assert.equal(later.status, 200);
  });

  test("rate limit: one IP trying many emails is limited too", async () => {
    const limiter = new AttemptLimiter();
    const deps = signInDeps({ [INVITED]: "correct horse", [OTHER]: "battery staple" });
    for (let i = 0; i < 5; i++) await signIn(i % 2 ? INVITED : OTHER, `nope ${i}xxxx`, deps, limiter, "9.9.9.9", i);
    assert.equal((await signIn(OTHER, "battery staple", deps, limiter, "9.9.9.9", 10)).status, 429);
    assert.equal((await signIn(OTHER, "battery staple", deps, limiter, "8.8.8.8", 10)).status, 200, "another IP and an email under the limit");
  });

  test("rate limit: Supabase's own 429 reads as too many tries", async () => {
    const deps = signInDeps({});
    deps.signIn = async () => ({ user: null, error: { status: 429, code: "over_request_rate_limit", message: "rate" } });
    const r = await signIn(INVITED, "whatever123", deps);
    assert.equal(r.status, 429);
    assert.equal(r.body.error, TOO_MANY_PASSWORD_TRIES);
  });

  test("limiter: a success clears the email's count", () => {
    const l = new AttemptLimiter(2, 1000);
    l.recordFailure(["email:a"], 0);
    l.recordFailure(["email:a"], 1);
    assert.equal(l.isLimited(["email:a"], 2), true);
    l.clear("email:a");
    assert.equal(l.isLimited(["email:a"], 3), false);
    assert.equal(l.isLimited(["email:a"], 3), false);
  });

  // Set-password fake: the session user, how they proved it's them, and what was saved.
  function setDeps(opts: { email?: string | null; fresh?: boolean; current?: string; code?: string; saved?: string[] }) {
    const saved = opts.saved ?? [];
    return {
      async getUser() {
        return opts.email === null ? null : { id: "u1", email: opts.email ?? INVITED, app_metadata: {} };
      },
      async freshFromEmailCode() {
        return !!opts.fresh;
      },
      async verifyPassword(_e: string, p: string) {
        return p === opts.current ? null : { status: 400, code: "invalid_credentials", message: "Invalid login credentials" };
      },
      async verifyCode(_e: string, c: string) {
        return c === opts.code ? null : { status: 403, code: "otp_expired", message: "Token has expired or is invalid" };
      },
      async updatePassword(p: string) {
        saved.push(p);
        return null;
      },
      async markPasswordSet() {},
    };
  }

  test("skip path: a new account that skips has no password and gets the no-password message", async () => {
    // The sign-in page's Skip link sets nothing; the account stays code-only.
    const deps = signInDeps({ [INVITED]: null });
    const r = await signIn(INVITED, "guessing123", deps);
    assert.equal(r.body.error, NO_PASSWORD_YET);
    assert.equal(r.body.noPassword, true);
  });

  test("create a password right after the code (fresh email-code session)", async () => {
    const saved: string[] = [];
    const r = await setPassword({ password: "a long passphrase", ip: null }, setDeps({ fresh: true, saved }), new AttemptLimiter());
    assert.equal(r.status, 200);
    assert.deepEqual(saved, ["a long passphrase"]);
  });

  test("forgot password: fresh code session sets a new one without the old password", async () => {
    const saved: string[] = [];
    const r = await setPassword({ password: "brand new phrase", ip: null }, setDeps({ fresh: true, current: "old one!!", saved }), new AttemptLimiter());
    assert.equal(r.status, 200);
    assert.deepEqual(saved, ["brand new phrase"]);
  });

  test("without a fresh code session, setting a password needs proof", async () => {
    const saved: string[] = [];
    const r = await setPassword({ password: "a long passphrase", ip: null }, setDeps({ fresh: false, saved }), new AttemptLimiter());
    assert.equal(r.status, 403);
    assert.equal(r.body.error, PROOF_NEEDED);
    assert.deepEqual(saved, []);
  });

  test("Settings change: needs the right current password, counted by the limiter", async () => {
    const saved: string[] = [];
    const limiter = new AttemptLimiter();
    const deps = setDeps({ current: "old phrase 1", saved });
    const bad = await setPassword({ password: "a long passphrase", currentPassword: "nope nope", ip: "1.2.3.4" }, deps, limiter);
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, "current");
    const good = await setPassword({ password: "a long passphrase", currentPassword: "old phrase 1", ip: "1.2.3.4" }, deps, limiter);
    assert.equal(good.status, 200);
    assert.deepEqual(saved, ["a long passphrase"]);
    for (let i = 0; i < 5; i++) await setPassword({ password: "a long passphrase", currentPassword: `x${i}xxxxxx`, ip: "1.2.3.4" }, deps, limiter);
    const blocked = await setPassword({ password: "a long passphrase", currentPassword: "old phrase 1", ip: "1.2.3.4" }, deps, limiter);
    assert.equal(blocked.status, 429);
  });

  test("Settings first password: a fresh 6-digit code is the proof", async () => {
    const saved: string[] = [];
    const deps = setDeps({ code: "123456", saved });
    const bad = await setPassword({ password: "a long passphrase", code: "654321", ip: null }, deps, new AttemptLimiter());
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, "code");
    const good = await setPassword({ password: "a long passphrase", code: "123 456", ip: null }, deps, new AttemptLimiter());
    assert.equal(good.status, 200);
    assert.deepEqual(saved, ["a long passphrase"]);
  });

  test("setting a password with no session asks to sign in again", async () => {
    const r = await setPassword({ password: "a long passphrase", ip: null }, setDeps({ email: null, fresh: true }), new AttemptLimiter());
    assert.equal(r.status, 401);
  });

  test("password rules: length, the 20 most common, the user's own email", async () => {
    assert.equal(COMMON_PASSWORDS.length, 20);
    assert.match(passwordProblem("short1", INVITED) ?? "", /at least 8/);
    assert.equal(passwordProblem("x".repeat(73)), "Use 72 characters or fewer.");
    for (const p of COMMON_PASSWORDS.filter((c) => c.length >= 8)) assert.match(passwordProblem(p) ?? "", /most common/, p);
    assert.match(passwordProblem("PASSWORD1") ?? "", /most common/, "case-insensitive");
    assert.match(passwordProblem(INVITED, INVITED) ?? "", /email/);
    assert.match(passwordProblem("Sam@School.org", INVITED) ?? "", /email/);
    assert.match(passwordProblem("samantha", "samantha@school.org") ?? "", /email/, "the part before @ too");
    assert.equal(passwordProblem("purple tiger 42", INVITED), null);
    // The server applies the same rules.
    const r = await setPassword({ password: "password1", ip: null }, setDeps({ fresh: true }), new AttemptLimiter());
    assert.equal(r.status, 400);
    assert.equal(r.body.field, "password");
  });

  test("strength hint grows with length and variety and never passes a rejected password", () => {
    assert.equal(passwordStrength("").score, 0);
    assert.equal(passwordStrength("password1").score, 0);
    assert.equal(passwordStrength("abcdefgh").score, 1);
    assert.equal(passwordStrength("abcdefgh12").score, 2);
    assert.equal(passwordStrength("Purple-Tiger-42!").score, 3);
  });

  test("fresh email-code session: an otp sign-in in the last 10 minutes, nothing else", () => {
    const now = 1_000_000;
    assert.equal(signedInByEmailCodeRecently([{ method: "otp", timestamp: now - 60 }], now), true);
    assert.equal(signedInByEmailCodeRecently([{ method: "otp", timestamp: now - 11 * 60 }], now), false);
    assert.equal(signedInByEmailCodeRecently([{ method: "password", timestamp: now - 5 }], now), false);
    assert.equal(signedInByEmailCodeRecently([{ method: "oauth", timestamp: now - 5 }], now), false);
    assert.equal(signedInByEmailCodeRecently(null, now), false);
    const payload = Buffer.from(JSON.stringify({ amr: [{ method: "otp", timestamp: now }] })).toString("base64url");
    assert.deepEqual(amrFromAccessToken(`h.${payload}.s`), [{ method: "otp", timestamp: now }]);
    assert.equal(amrFromAccessToken("garbage"), null);
  });

  test("the remembered sign-in method survives a full sign-out", () => {
    assert.equal(isTangentKey("tangent-signin-method"), false);
  });
});
