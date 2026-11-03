import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NOT_INVITED, isEmailAllowed, normalizeEmail } from "@/lib/auth/access";
import { sendFailure } from "@/lib/auth/messages";
import { authCallbackUrl, originHeaders, requestOrigin } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends one email with both a 6-digit code and a sign-in link, only to invited
// emails, so strangers can't create Supabase Auth users by typing an address.
// Uninvited addresses are told so before anything is sent (the product asks for
// that over hiding who is invited).
export async function POST(request: Request) {
  const started = Date.now();
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json({ ok: false, notInvited: true, error: NOT_INVITED }, { status: 403 });
  }

  const redirectTo = authCallbackUrl(requestOrigin(originHeaders(request), request.url), typeof body.next === "string" ? body.next : null);
  const supabase = createClient();
  const sendStart = Date.now();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  // Hop timing for sign-in slowness (no email or token is logged).
  console.log(`[auth] magic-link: supabase send ${Date.now() - sendStart}ms, total ${Date.now() - started}ms`);
  if (error) {
    console.warn("[auth/magic-link] send failed:", error.code ?? error.status ?? "error");
    const failure = sendFailure(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
