import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/access";
import { sendFailure } from "@/lib/auth/messages";
import { logServerError } from "@/lib/server-log";
import { authCallbackUrl, originHeaders, requestOrigin } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends one email with both a sign-in code (6–10 digits, a Supabase project
// setting) and a sign-in link. Since Round 4 anyone can create an account;
// uninvited accounts land on the waitlist page (lib/auth/gate.ts). Supabase's
// own email rate limit and CAPTCHA guard this (docs/MANUAL-STEPS.md, Round 4).
// Sign in and Create account (app/auth/signup) both send through Supabase OTP.
export async function POST(request: Request) {
  const started = Date.now();
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const redirectTo = authCallbackUrl(requestOrigin(originHeaders(request), request.url), typeof body.next === "string" ? body.next : null);
  const supabase = createClient();
  const sendStart = Date.now();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  // Hop timing for sign-in slowness (no email or token is logged).
  console.log(`[auth] magic-link: supabase send ${Date.now() - sendStart}ms, total ${Date.now() - started}ms`);
  if (error) {
    // The real cause (status, code, message), never the email or keys.
    logServerError("auth/magic-link", error);
    const failure = sendFailure(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
