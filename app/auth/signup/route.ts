import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/access";
import { sendFailure } from "@/lib/auth/messages";
import { findAccount } from "@/lib/auth/password-server";
import { ALREADY_HAVE_ACCOUNT, isFinishedAccount } from "@/lib/auth/signup";
import { authCallbackUrl, originHeaders, requestOrigin } from "@/lib/auth/redirect";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Create account tab: email → code → password → onboarding. An email that
// already has an account gets { alreadyExists } and the form switches to Sign
// in (lib/auth/signup.ts). Anyone may create an account; one that isn't on
// ALLOWED_EMAILS lands on the waitlist page (lib/auth/gate.ts).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    if (isFinishedAccount(await findAccount(email))) {
      return NextResponse.json({ ok: false, alreadyExists: true, error: ALREADY_HAVE_ACCOUNT }, { status: 409 });
    }
  } catch (e) {
    logServerError("auth/signup", e, { step: "lookup" });
    return NextResponse.json({ ok: false, error: "Couldn't start your account. Try again in a moment." }, { status: 500 });
  }

  const redirectTo = authCallbackUrl(requestOrigin(originHeaders(request), request.url), typeof body.next === "string" ? body.next : null);
  const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
  if (error) {
    logServerError("auth/signup", error, { step: "send" });
    const failure = sendFailure(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
