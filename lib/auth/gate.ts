// Who may reach what (Round 4, Phase 1.2 and 1.5). Pure, so middleware.ts,
// withUser() and lib/auth-gate.test.ts share one set of rules.
//
//   signed out  pages go to /signin, APIs get 401
//   waitlist    signed in but not on ALLOWED_EMAILS: keeps the session, every
//               page goes to /waitlist, every API gets 403
//   under 13    said so on the first onboarding screen: every page goes to
//               /not-yet, every API gets 403 (docs/tangent/ROUND5-PLAN.md §2)
//   allowed     the app
//
// /auth/* (sign-in steps, sign-out) and /api/cron/* (own secret) skip the
// session check. /dev/* previews exist in development only.

import { isEmailAllowed } from "./access";

export type Access = "signed_out" | "waitlist" | "under13" | "allowed";

export const WAITLIST_PATH = "/waitlist";
export const UNDER_13_PATH = "/not-yet";
export const SIGNIN_PATH = "/signin";
/** Where "Delete my account" ends. Public: the account and its session are gone. */
export const GOODBYE_PATH = "/goodbye";

export const WAITLIST_API_ERROR = "You're on the waitlist. We'll email you when your spot opens.";
export const UNDER_13_API_ERROR = "Tangent is for students 13 and up.";

type GateUser = { email?: string | null; app_metadata?: unknown } | null | undefined;

/** True when the account was marked under 13 in onboarding. Only the service
 *  role can write app_metadata, so the student can't clear it. */
export function isUnder13(appMetadata: unknown): boolean {
  return (appMetadata as { under_13?: unknown } | null)?.under_13 === true;
}

/** True when the owner approved this account from the waitlist page. Only the
 *  service role can write app_metadata, so the student can't set it. */
export function isWaitlistApproved(appMetadata: unknown): boolean {
  return (appMetadata as { waitlist?: unknown } | null)?.waitlist === "approved";
}

/** In by ALLOWED_EMAILS or approved from the waitlist (Round 5A, 1.5). */
export function isAllowedUser(user: { email?: string | null; app_metadata?: unknown } | null | undefined): boolean {
  if (!user) return false;
  return isEmailAllowed(user.email) || isWaitlistApproved(user.app_metadata);
}

export function accessOf(user: GateUser): Access {
  if (!user) return "signed_out";
  if (isUnder13(user.app_metadata)) return "under13";
  if (!isAllowedUser(user)) return "waitlist";
  return "allowed";
}

/** Paths that skip the session check entirely. */
export function skipsSessionCheck(pathname: string): boolean {
  return pathname.startsWith("/auth/") || pathname.startsWith("/api/cron/");
}

export type GateDecision =
  | { kind: "next" }
  | { kind: "not_found" }
  | { kind: "redirect"; to: string }
  | { kind: "json"; status: 401 | 403; error: string };

const HOLDING_PAGE: Partial<Record<Access, string>> = {
  waitlist: WAITLIST_PATH,
  under13: UNDER_13_PATH,
};

/**
 * What to do with a request. `next` is where a signed-in student should land
 * after /signin (already passed through safeNext by the caller).
 */
export function gate(opts: {
  pathname: string;
  search?: string;
  access: Access;
  isDev: boolean;
  next?: string;
}): GateDecision {
  const { pathname, access, isDev } = opts;
  if (skipsSessionCheck(pathname)) return { kind: "next" };
  if (pathname === "/dev" || pathname.startsWith("/dev/")) return isDev ? { kind: "next" } : { kind: "not_found" };

  if (pathname === GOODBYE_PATH) return { kind: "next" };

  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (access === "signed_out") {
    if (isApi) return { kind: "json", status: 401, error: "Not signed in" };
    if (pathname === SIGNIN_PATH) return { kind: "next" };
    if (pathname === WAITLIST_PATH || pathname === UNDER_13_PATH) return { kind: "redirect", to: SIGNIN_PATH };
    const target = pathname === "/" ? SIGNIN_PATH : `${SIGNIN_PATH}?next=${encodeURIComponent(pathname + (opts.search ?? ""))}`;
    return { kind: "redirect", to: target };
  }

  const holding = HOLDING_PAGE[access];
  if (holding) {
    if (isApi) return { kind: "json", status: 403, error: access === "under13" ? UNDER_13_API_ERROR : WAITLIST_API_ERROR };
    if (pathname === holding) return { kind: "next" };
    return { kind: "redirect", to: holding };
  }

  // Allowed.
  if (pathname === SIGNIN_PATH) return { kind: "redirect", to: opts.next ?? "/" };
  if (pathname === WAITLIST_PATH || pathname === UNDER_13_PATH || pathname === "/invite-only") return { kind: "redirect", to: "/" };
  return { kind: "next" };
}
