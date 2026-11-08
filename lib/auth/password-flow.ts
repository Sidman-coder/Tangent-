// The decisions behind /auth/password (sign in) and /auth/password/set (create,
// reset or change), with Supabase passed in so the order of checks is tested:
// the limiter before Supabase, one message for a wrong password whether or not
// the account exists, and (Round 4) waitlisted accounts signed in but sent to
// the waitlist page instead of refused.
import { isEmailAllowed, normalizeEmail } from "./access";
import { WAITLIST_PATH } from "./gate";
import { CODE_INCOMPLETE, codeFailure, isCodeLength } from "./messages";
import {
  AttemptLimiter,
  NO_PASSWORD_YET,
  TOO_MANY_PASSWORD_TRIES,
  WRONG_PASSWORD,
  attemptKeys,
  hasPasswordFlag,
  passwordProblem,
} from "./password";

export type FlowResult = { status: number; body: Record<string, unknown> };

type AuthError = { status?: number; code?: string; message: string } | null;
type AuthUser = { id: string; email?: string | null; app_metadata?: unknown } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInDeps = {
  signIn(email: string, password: string): Promise<{ user: AuthUser; error: AuthError }>;
  /** Whether an account with this email has a password. False when there is no
   *  account, so the two cases read the same. */
  hasPassword(email: string): Promise<boolean>;
  signOut(): Promise<void>;
  markPasswordSet(userId: string): Promise<void>;
};

export async function passwordSignIn(
  input: { email: unknown; password: unknown; next: string; ip: string | null },
  deps: SignInDeps,
  limiter: AttemptLimiter,
  now = Date.now()
): Promise<FlowResult> {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!EMAIL_RE.test(email)) return { status: 400, body: { ok: false, error: "Enter a valid email address." } };
  if (!password) return { status: 400, body: { ok: false, error: "Enter your password." } };

  const keys = attemptKeys(email, input.ip);
  if (limiter.isLimited(keys, now)) return { status: 429, body: { ok: false, tooMany: true, error: TOO_MANY_PASSWORD_TRIES } };

  const { user, error } = await deps.signIn(email, password);
  if (error || !user) {
    if (error?.status === 429) return { status: 429, body: { ok: false, tooMany: true, error: TOO_MANY_PASSWORD_TRIES } };
    limiter.recordFailure(keys, now);
    // An invited email with no account and an account with no password get the
    // same answer, so the reply never says whether the account exists.
    const set = await deps.hasPassword(email).catch(() => true);
    return set
      ? { status: 400, body: { ok: false, error: WRONG_PASSWORD } }
      : { status: 400, body: { ok: false, noPassword: true, error: NO_PASSWORD_YET } };
  }

  limiter.clear(`email:${email}`);
  if (!hasPasswordFlag(user.app_metadata)) await deps.markPasswordSet(user.id).catch(() => undefined);
  // Not invited yet: the session stays, and middleware keeps them on the waitlist page.
  return { status: 200, body: { ok: true, next: isEmailAllowed(user.email) ? input.next : WAITLIST_PATH } };
}

export type SetDeps = {
  getUser(): Promise<AuthUser>;
  /** Signed in by email code or link in the last 10 minutes. */
  freshFromEmailCode(): Promise<boolean>;
  verifyPassword(email: string, password: string): Promise<AuthError>;
  verifyCode(email: string, code: string): Promise<AuthError>;
  updatePassword(password: string): Promise<AuthError>;
  markPasswordSet(userId: string): Promise<void>;
};

export const PROOF_NEEDED = "For your security, confirm with your current password or a new email code.";

/** Create, reset or change the signed-in student's password. Proof is the
 *  current password, a fresh email code, or (from the sign-in page) a
 *  session that came from an email code moments ago. */
export async function setPassword(
  input: { password: unknown; currentPassword?: unknown; code?: unknown; ip: string | null },
  deps: SetDeps,
  limiter: AttemptLimiter,
  now = Date.now()
): Promise<FlowResult> {
  const user = await deps.getUser();
  if (!user?.email) return { status: 401, body: { ok: false, error: "Your session ended. Sign in again." } };
  const email = normalizeEmail(user.email);

  const password = typeof input.password === "string" ? input.password : "";
  const problem = passwordProblem(password, email);
  if (problem) return { status: 400, body: { ok: false, field: "password", error: problem } };

  const current = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const code = typeof input.code === "string" ? input.code.replace(/\D/g, "") : "";
  if (current) {
    const keys = attemptKeys(email, input.ip);
    if (limiter.isLimited(keys, now)) return { status: 429, body: { ok: false, tooMany: true, error: TOO_MANY_PASSWORD_TRIES } };
    const err = await deps.verifyPassword(email, current);
    if (err) {
      if (err.status === 429) return { status: 429, body: { ok: false, tooMany: true, error: TOO_MANY_PASSWORD_TRIES } };
      limiter.recordFailure(keys, now);
      return { status: 400, body: { ok: false, field: "current", error: "Your current password isn't right." } };
    }
    limiter.clear(`email:${email}`);
  } else if (code) {
    if (!isCodeLength(code)) return { status: 400, body: { ok: false, field: "code", error: CODE_INCOMPLETE } };
    const err = await deps.verifyCode(email, code);
    if (err) {
      const failure = codeFailure(err);
      return { status: failure.status, body: { ok: false, field: "code", error: failure.error } };
    }
  } else if (!(await deps.freshFromEmailCode())) {
    return { status: 403, body: { ok: false, proofNeeded: true, error: PROOF_NEEDED } };
  }

  const err = await deps.updatePassword(password);
  if (err) {
    if (err.code === "same_password") return { status: 400, body: { ok: false, field: "password", error: "That's already your password. Pick a new one." } };
    if (err.code === "weak_password") return { status: 400, body: { ok: false, field: "password", error: err.message } };
    if (err.code === "reauthentication_needed" || err.code === "reauthentication_not_valid") return { status: 403, body: { ok: false, proofNeeded: true, error: PROOF_NEEDED } };
    if (err.status === 401 || err.code === "session_expired" || err.code === "session_not_found") return { status: 401, body: { ok: false, error: "Your session ended. Sign in again." } };
    return { status: 500, body: { ok: false, error: "Couldn't save your password. Try again." } };
  }
  // The password is saved either way; the caller says so when the flag isn't.
  const flagged = await deps.markPasswordSet(user.id).then(() => true, () => false);
  return { status: 200, body: flagged ? { ok: true } : { ok: true, flagSaved: false } };
}
