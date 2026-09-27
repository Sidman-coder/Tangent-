import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/safe-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing point for Google OAuth and magic-link sign-in. Exchanges the one-time
// code for a session cookie, then enforces the invite-only allowlist before the
// student ever reaches the app.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  const supabase = createClient();
  let error: unknown = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else {
    error = new Error("Missing code");
  }

  if (error) {
    const cause = error instanceof Error ? (error.cause as { code?: string } | undefined)?.code : undefined;
    console.warn("[auth/callback] sign-in failed:", error instanceof Error ? error.message : error, cause ? `(${cause})` : "");
    return NextResponse.redirect(new URL("/signin?error=link", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/invite-only", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
