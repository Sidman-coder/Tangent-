import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { amrFromAccessToken, clientIp, signedInByEmailCodeRecently } from "@/lib/auth/password";
import { setPassword } from "@/lib/auth/password-flow";
import { markPasswordSet, passwordLimiter } from "@/lib/auth/password-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create, reset or change the signed-in student's password. Proof is the
// current password, a new 6-digit code, or a sign-in by email code in the last
// 10 minutes (the step right after the code on the sign-in page).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown; currentPassword?: unknown; code?: unknown };
  const supabase = createClient();
  const result = await setPassword(
    { password: body.password, currentPassword: body.currentPassword, code: body.code, ip: clientIp(request.headers) },
    {
      async getUser() {
        const { data } = await supabase.auth.getUser();
        return data.user;
      },
      async freshFromEmailCode() {
        // getUser above already checked this session with Supabase.
        const { data } = await supabase.auth.getSession();
        return signedInByEmailCodeRecently(amrFromAccessToken(data.session?.access_token));
      },
      async verifyPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { status: error.status, code: error.code, message: error.message } : null;
      },
      async verifyCode(email, token) {
        // Settings asks for this code through /auth/recover.
        const { error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
        return error ? { status: error.status, code: error.code, message: error.message } : null;
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) console.warn("[auth/password/set] update failed:", error.code ?? error.status ?? "error");
        return error ? { status: error.status, code: error.code, message: error.message } : null;
      },
      markPasswordSet,
    },
    passwordLimiter
  );
  return NextResponse.json(result.body, { status: result.status });
}
