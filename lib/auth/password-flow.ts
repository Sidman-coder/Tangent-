// The decisions behind /auth/password (sign in) and /auth/password/set (create,
// reset or change), with Supabase passed in so the order of checks is tested:
// the invite list first on every path, the limiter before Supabase, and one
// message for a wrong password whether or not the account exists.
import { NOT_INVITED, isEmailAllowed, normalizeEmail } from "./access";
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
  if (!isEmailAllowed(email)) return { status: 403, body: { ok: false, notInvited: true, error: NOT_INVITED } };

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

  if (!isEmailAllowed(user.email)) {
    await deps.signOut();
    return { status: 403, body: { ok: false, notInvited: true, next: "/invite-only", error: NOT_INVITED } };
  }
  limiter.clear(`email:${email}`);
  if (!hasPasswordFlag(user.app_metadata)) await deps.markPasswordSet(user.id).catch(() => undefined);
  return { status: 200, body: { ok: true, next: input.next } };
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
 *  current password, a fresh 6-digit code, or (from the sign-in page) a
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
  if (!isEmailAllowed(email)) return { status: 403, body: { ok: false, notInvited: true, next: "/invite-only", error: NOT_INVITED } };

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
    if (code.length !== 6) return { status: 400, body: { ok: false, field: "code", error: "Enter the 6-digit code from the email." } };
    const err = await deps.verifyCode(email, code);
    if (err) {
      const expired = err.code === "otp_expired" || /expired/i.test(err.message);
      return {
        status: err.status === 429 ? 429 : 400,
        body: {
          ok: false,
          field: "code",
          error: err.status === 429 ? "Too many tries. Wait a minute, then try again." : expired ? "That code has expired. Send a new one." : "That code isn't right. Check the email and try again.",
        },
      };
    }
  } else if (!(await deps.freshFromEmailCode())) {
    return { status: 403, body: { ok: false, proofNeeded: true, error: PROOF_NEEDED } };
  }

  const err = await deps.updatePassword(password);
  if (err) {
    if (err.code === "same_password") return { status: 400, body: { ok: false, field: "password", error: "That's already your password. Pick a new one." } };
    if (err.code === "weak_password") return { status: 400, body: { ok: false, field: "password", error: err.message } };
    if (err.code === "reauthentication_needed") return { status: 403, body: { ok: false, proofNeeded: true, error: PROOF_NEEDED } };
    return { status: 500, body: { ok: false, error: "Couldn't save your password. Try again." } };
  }
  await deps.markPasswordSet(user.id).catch(() => undefined);
  return { status: 200, body: { ok: true } };
}
