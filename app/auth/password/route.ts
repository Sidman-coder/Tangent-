import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { clientIp } from "@/lib/auth/password";
import { passwordSignIn } from "@/lib/auth/password-flow";
import { recordWaitlist } from "@/lib/auth/waitlist-server";
import { accountHasPassword, markPasswordSet, passwordLimiter } from "@/lib/auth/password-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email + password sign-in. Invite list first, then the 5-per-15-minutes
// limiter, then Supabase. The password is never logged.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown; next?: unknown };
  const supabase = createClient();
  const result = await passwordSignIn(
    {
      email: body.email,
      password: body.password,
      next: safeNext(typeof body.next === "string" ? body.next : null),
      ip: clientIp(request.headers),
    },
    {
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) console.warn("[auth/password] sign-in failed:", error.code ?? error.status ?? "error");
        return { user: data.user, error: error ? { status: error.status, code: error.code, message: error.message } : null };
      },
      hasPassword: accountHasPassword,
      async signOut() {
        await supabase.auth.signOut();
      },
      markPasswordSet,
      joinWaitlist: recordWaitlist,
    },
    passwordLimiter
  );
  return NextResponse.json(result.body, { status: result.status });
}
