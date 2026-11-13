import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WAITLIST_PATH, isAllowedUser } from "@/lib/auth/gate";
import { recordWaitlist } from "@/lib/auth/waitlist-server";
import { safeNext } from "@/lib/auth/safe-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landing point for Google OAuth and the email sign-in link.
//   * ?code=…        (OAuth, PKCE) exchanged here for a session cookie.
//   * ?token_hash=…  (email link) handed to /auth/confirm, which verifies it
//     with a POST once the page has loaded in a real browser, so link scanners
//     that prefetch email links can't consume the token first.
// Not invited yet: the session stays and the student lands on the waitlist page.
export async function GET(request: Request) {
  const started = Date.now();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const next = safeNext(url.searchParams.get("next"));

  if (!code && tokenHash) {
    const confirm = new URL("/auth/confirm", url.origin);
    confirm.searchParams.set("token_hash", tokenHash);
    confirm.searchParams.set("type", url.searchParams.get("type") ?? "email");
    confirm.searchParams.set("next", next);
    return NextResponse.redirect(confirm);
  }
  if (!code) {
    console.warn("[auth/callback] sign-in failed: missing code", url.searchParams.get("error_code") ?? "");
    return NextResponse.redirect(new URL("/signin?error=link", url.origin));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  console.log(`[auth] callback exchange: ${Date.now() - started}ms`);
  if (error) {
    const cause = (error.cause as { code?: string } | undefined)?.code ?? (error as { code?: string }).code;
    console.warn("[auth/callback] sign-in failed:", error.message, cause ? `(${cause})` : "");
    return NextResponse.redirect(new URL("/signin?error=link", url.origin));
  }

  // The exchange returns the user, so no second getUser() round-trip.
  if (!data.user || !isAllowedUser(data.user)) {
    if (data.user) await recordWaitlist(data.user);
    return NextResponse.redirect(new URL(WAITLIST_PATH, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
