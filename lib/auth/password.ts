// Optional password sign-in: the rules a new password must pass, the hint shown
// while typing, the failed-attempt limiter, and the messages every path shares.
// Pure (no Supabase, no Next) so it is unit tested in lib/auth-password.test.ts.
// Passwords are never logged or stored here; the limiter keys on email and IP.

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt (Supabase Auth) ignores everything after 72 bytes.
export const MAX_PASSWORD_LENGTH = 72;

export const WRONG_PASSWORD = "Wrong email or password.";
export const NO_PASSWORD_YET = "This account doesn't have a password yet. Use an email code, then set one in Settings.";
export const TOO_MANY_PASSWORD_TRIES = "Too many tries. Use an email code, or wait 15 minutes and try again.";

// The 20 most common leaked passwords (NordPass / Have I Been Pwned top lists).
// Short ones are already caught by the length rule; they stay so the list reads
// as the real top 20.
export const COMMON_PASSWORDS = [
  "123456",
  "123456789",
  "12345678",
  "password",
  "qwerty123",
  "qwerty1",
  "111111",
  "12345",
  "secret",
  "123123",
  "1234567890",
  "1234567",
  "000000",
  "qwerty",
  "abc123",
  "password1",
  "iloveyou",
  "11111111",
  "dragon",
  "monkey",
];
const COMMON = new Set(COMMON_PASSWORDS);

/** Why `password` can't be used, or null when it can. */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  const lower = password.trim().toLowerCase();
  if (COMMON.has(lower)) return "That's one of the most common passwords. Pick something less guessable.";
  const e = (email ?? "").trim().toLowerCase();
  if (e) {
    const local = e.split("@")[0];
    if (lower === e || (local.length >= 3 && lower === local)) return "Don't use your email as your password.";
  }
  return null;
}

export type PasswordRule = { id: "length" | "common" | "email"; label: string; met: boolean };

/** The rules as calm hints that turn green one by one (Round 4, Phase 1.3).
 *  Same checks as passwordProblem; all met means it passes. */
export function passwordRules(password: string, email?: string | null): PasswordRule[] {
  const lower = password.trim().toLowerCase();
  const e = (email ?? "").trim().toLowerCase();
  const local = e.split("@")[0] ?? "";
  const isEmail = !!e && (lower === e || (local.length >= 3 && lower === local));
  return [
    { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH },
    { id: "common", label: "Not a common password", met: !!password && !COMMON.has(lower) },
    { id: "email", label: "Not your email", met: !!password && !isEmail },
  ];
}

export type Strength = { score: 0 | 1 | 2 | 3; label: string };

/** A rough hint while typing. It never blocks; passwordProblem does. */
export function passwordStrength(password: string, email?: string | null): Strength {
  if (!password) return { score: 0, label: "" };
  if (passwordProblem(password, email)) return { score: 0, label: "Too weak" };
  let points = 0;
  if (password.length >= 12) points++;
  if (password.length >= 16) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  if (points >= 3) return { score: 3, label: "Strong" };
  if (points >= 1) return { score: 2, label: "Okay. Longer is stronger." };
  return { score: 1, label: "Weak. Add length or mix in numbers and symbols." };
}

export const ATTEMPT_LIMIT = 5;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 5000;

/** Failed password attempts per key ("email:…", "ip:…") in a sliding 15-minute
 *  window. In memory, so each server instance counts on its own; Supabase's
 *  own sign-in rate limit sits behind it. */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;

  constructor(limit = ATTEMPT_LIMIT, windowMs = ATTEMPT_WINDOW_MS) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  isLimited(keys: string[], now = Date.now()): boolean {
    return keys.some((k) => this.recent(k, now).length >= this.limit);
  }

  recordFailure(keys: string[], now = Date.now()): void {
    if (this.hits.size > MAX_KEYS) {
      Array.from(this.hits.keys()).forEach((k) => this.recent(k, now));
    }
    keys.forEach((k) => this.hits.set(k, [...this.recent(k, now), now]));
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}

export function attemptKeys(email: string, ip: string | null): string[] {
  return ip ? [`email:${email}`, `ip:${ip}`] : [`email:${email}`];
}

/** The client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || null;
}

// Email sign-in methods Supabase writes into the session's `amr` claim.
const EMAIL_CODE_METHODS = new Set(["otp", "magiclink", "recovery", "email/signup", "invite"]);
export const FRESH_CODE_WINDOW_SEC = 10 * 60;

/** True when this session came from an email code or link in the last 10
 *  minutes: the proof that lets the sign-in page set a password right after
 *  the code (new account, forgot password) without asking for the old one. */
export function signedInByEmailCodeRecently(amr: unknown, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    const e = entry as { method?: unknown; timestamp?: unknown };
    return (
      typeof e.method === "string" &&
      EMAIL_CODE_METHODS.has(e.method) &&
      typeof e.timestamp === "number" &&
      nowSec - e.timestamp >= -60 &&
      nowSec - e.timestamp <= FRESH_CODE_WINDOW_SEC
    );
  });
}

/** The `amr` claim from a Supabase access token (already verified by getUser). */
export function amrFromAccessToken(token: string | null | undefined): unknown {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return (JSON.parse(json) as { amr?: unknown }).amr ?? null;
  } catch {
    return null;
  }
}

/** Accounts flagged by Tangent's own set-password route (app_metadata can't be
 *  written by the student). */
export function hasPasswordFlag(appMetadata: unknown): boolean {
  return (appMetadata as { password_set?: unknown } | null)?.password_set === true;
}
