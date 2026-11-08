import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NOT_INVITED, isEmailAllowed, normalizeEmail } from "@/lib/auth/access";
import { sendFailure } from "@/lib/auth/messages";
import { authCallbackUrl, originHeaders, requestOrigin } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Forgot password: sends the Reset Password email (a 6-digit recovery code and a
// link), only to invited emails. An email with no account gets the same reply.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!isEmailAllowed(email)) {
    return NextResponse.json({ ok: false, notInvited: true, error: NOT_INVITED }, { status: 403 });
  }

  const redirectTo = authCallbackUrl(requestOrigin(originHeaders(request), request.url), typeof body.next === "string" ? body.next : null);
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.warn("[auth/recover] send failed:", error.code ?? error.status ?? "error");
    const failure = sendFailure(error);
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}
