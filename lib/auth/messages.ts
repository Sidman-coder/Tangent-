// Plain words for what Supabase Auth reports when sending or checking an email
// code. Pure, so the mapping is unit tested; the raw message is never shown.

export type AuthFailure = { status?: number; code?: string; message?: string };

const RATE_LIMIT_RE = /rate limit|too many/i;

function rateLimited(e: AuthFailure): boolean {
  return e.status === 429 || (e.code ?? "").startsWith("over_") || RATE_LIMIT_RE.test(e.message ?? "");
}

export const SEND_RATE_LIMITED = "Too many sign-in emails. Wait a minute, then try again.";
export const CODE_RATE_LIMITED = "Too many tries. Wait a minute, then try again.";
// Supabase answers otp_expired ("Token has expired or is invalid") for both a
// wrong and an old code, so one message (Round 4, Phase 1.4).
export const CODE_REJECTED = "That code didn't work. Check all the digits, or send a new code.";

// Supabase's email OTP length is a project setting (6 to 10 digits), so every
// code field accepts any length in that range and nothing submits on its own.
export const CODE_MIN_LENGTH = 6;
export const CODE_MAX_LENGTH = 10;
export const CODE_INCOMPLETE = "Enter the full code from the email.";

/** The digits of a pasted or typed code, at most CODE_MAX_LENGTH of them. */
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CODE_MAX_LENGTH);
}

/** True for a code of 6 to 10 digits. */
export function isCodeLength(code: string): boolean {
  return /^\d+$/.test(code) && code.length >= CODE_MIN_LENGTH && code.length <= CODE_MAX_LENGTH;
}

export function sendFailure(e: AuthFailure): { status: number; error: string } {
  if (rateLimited(e)) return { status: 429, error: SEND_RATE_LIMITED };
  if (e.code === "email_address_invalid" || e.code === "validation_failed") {
    return { status: 400, error: "Enter a valid email address." };
  }
  if (e.code === "signup_disabled" || e.code === "otp_disabled" || e.code === "email_provider_disabled") {
    return { status: 403, error: "Email sign-in is turned off right now. Try Google, or ask whoever invited you." };
  }
  return { status: 500, error: "Couldn't send the email. Try again in a moment." };
}

export function codeFailure(e: AuthFailure): { status: number; error: string } {
  if (rateLimited(e)) return { status: 429, error: CODE_RATE_LIMITED };
  return { status: 400, error: CODE_REJECTED };
}
