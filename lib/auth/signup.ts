// The Create account tab (Round 4, Phase 1.2). Pure so the rules are tested in
// lib/auth-gate.test.ts.
//
// An existing account is told "You already have an account. Sign in instead"
// and the form switches to Sign in. This is the one place Tangent says an
// email has an account; Sign in never does. A sign-up started in the last hour
// that never got a password (the student closed the tab at the code step)
// counts as not finished, so Create account can pick it up again.

export const ALREADY_HAVE_ACCOUNT = "You already have an account. Sign in instead.";

const UNFINISHED_MS = 60 * 60 * 1000;

export function isFinishedAccount(
  account: { createdAt: string | null; passwordSet: boolean } | null,
  now = Date.now()
): boolean {
  if (!account) return false;
  if (account.passwordSet) return true;
  const created = Date.parse(account.createdAt ?? "");
  return !Number.isFinite(created) || now - created >= UNFINISHED_MS;
}
