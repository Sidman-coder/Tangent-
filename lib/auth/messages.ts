// Plain words for what Supabase Auth reports when sending or checking an email
// code. Pure, so the mapping is unit tested; the raw message is never shown.

export type AuthFailure = { status?: number; code?: string; message?: string };

const RATE_LIMIT_RE = /rate limit|too many/i;

function rateLimited(e: AuthFailure): boolean {
  return e.status === 429 || (e.code ?? "").startsWith("over_") || RATE_LIMIT_RE.test(e.message ?? "");
}

export const SEND_RATE_LIMITED = "Too many sign-in emails. Wait a minute, then try again.";
export const CODE_RATE_LIMITED = "Too many tries. Wait a minute, then try again.";
// Supabase answers "Token has expired or is invalid" for both, so one message.
export const CODE_REJECTED = "That code is wrong or has expired. Check it, or send a new one.";

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
