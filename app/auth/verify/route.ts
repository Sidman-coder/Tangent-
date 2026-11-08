import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed, normalizeEmail } from "@/lib/auth/access";
import { CODE_INCOMPLETE, codeFailure, isCodeLength } from "@/lib/auth/messages";
import { WAITLIST_PATH } from "@/lib/auth/gate";
import { logServerError } from "@/lib/server-log";
import { safeNext } from "@/lib/auth/safe-next";
import { hasPasswordFlag } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

type Body = { email?: unknown; token?: unknown; token_hash?: unknown; type?: unknown; next?: unknown; purpose?: unknown };

// Finishes email sign-in with either the 6–10 digit code ({email, token}) or the
// link's token hash ({token_hash, type}, posted by /auth/confirm). A POST, so an
// email scanner that prefetches the link can't use up the token.
export async function POST(request: Request) {
  const started = Date.now();
  const body = (await request.json().catch(() => ({}))) as Body;
  const next = safeNext(typeof body.next === "string" ? body.next : null);
  const supabase = createClient();

  let result;
  if (typeof body.token === "string") {
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const token = body.token.replace(/\D/g, "");
    if (!email || !isCodeLength(token)) {
      return NextResponse.json({ ok: false, error: CODE_INCOMPLETE }, { status: 400 });
    }
    // A forgot-password code comes from the Reset Password email.
    result = await supabase.auth.verifyOtp({ email, token, type: body.purpose === "reset" ? "recovery" : "email" });
  } else if (typeof body.token_hash === "string" && body.token_hash) {
    const type = EMAIL_TYPES.includes(body.type as EmailOtpType) ? (body.type as EmailOtpType) : "email";
    result = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type });
  } else {
    return NextResponse.json({ ok: false, error: "Missing code." }, { status: 400 });
  }
  console.log(`[auth] verify: ${Date.now() - started}ms`);

  const { data, error } = result;
  if (error) {
    logServerError("auth/verify", error);
    const failure = codeFailure(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }

  // Use the user verifyOtp returned instead of another round-trip to Supabase.
  if (!data.user) {
    return NextResponse.json({ ok: false, error: codeFailure({}).error }, { status: 400 });
  }
  // The sign-in page offers "Create a password" to a new account that has none.
  const created = Date.parse(data.user.created_at ?? "");
  const newAccount = Number.isFinite(created) && Date.now() - created < 60 * 60 * 1000;
  // Not invited yet: signed in all the same; middleware keeps them on the waitlist page.
  const dest = isEmailAllowed(data.user.email) ? next : WAITLIST_PATH;
  return NextResponse.json({ ok: true, next: dest, passwordSet: hasPasswordFlag(data.user.app_metadata), newAccount });
}
