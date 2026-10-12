import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NOT_INVITED, isEmailAllowed, normalizeEmail } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/safe-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

type Body = { email?: unknown; token?: unknown; token_hash?: unknown; type?: unknown; next?: unknown };

// Finishes email sign-in with either the 6-digit code ({email, token}) or the
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
    if (!email || token.length !== 6) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code from the email." }, { status: 400 });
    }
    if (!isEmailAllowed(email)) {
      return NextResponse.json({ ok: false, notInvited: true, error: NOT_INVITED }, { status: 403 });
    }
    result = await supabase.auth.verifyOtp({ email, token, type: "email" });
  } else if (typeof body.token_hash === "string" && body.token_hash) {
    const type = EMAIL_TYPES.includes(body.type as EmailOtpType) ? (body.type as EmailOtpType) : "email";
    result = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type });
  } else {
    return NextResponse.json({ ok: false, error: "Missing code." }, { status: 400 });
  }
  console.log(`[auth] verify: ${Date.now() - started}ms`);

  const { data, error } = result;
  if (error) {
    const code = (error as { code?: string }).code ?? "";
    console.warn("[auth/verify] failed:", error.message, code ? `(${code})` : "");
    if (error.status === 429) {
      return NextResponse.json({ ok: false, error: "Too many tries. Wait a minute, then try again." }, { status: 429 });
    }
    const expired = code === "otp_expired" || /expired/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        expired,
        error: expired ? "That code has expired. Send a new one." : "That code isn't right. Check the email and try again.",
      },
      { status: 400 }
    );
  }

  // Use the user verifyOtp returned instead of another round-trip to Supabase.
  if (!data.user || !isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: false, notInvited: true, next: "/invite-only", error: NOT_INVITED }, { status: 403 });
  }
  return NextResponse.json({ ok: true, next });
}
