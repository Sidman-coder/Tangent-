import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/auth/access";
import { safeNext } from "@/lib/auth/safe-next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a magic sign-in link — but only to invited emails, so strangers can't
// create Supabase Auth users by typing an address. The response is identical
// either way, so it doesn't reveal who is on the invite list.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  if (isEmailAllowed(email)) {
    const origin = new URL(request.url).origin;
    const next = safeNext(typeof body.next === "string" ? body.next : null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      console.warn("[auth/magic-link] send failed:", error.message);
      const status = error.status === 429 ? 429 : 500;
      const message = status === 429 ? "Too many requests — wait a minute and try again." : "Could not send the link. Try again.";
      return NextResponse.json({ ok: false, error: message }, { status });
    }
  }

  return NextResponse.json({ ok: true });
}
