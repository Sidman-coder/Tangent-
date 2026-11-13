import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { joinWaitlist, type WaitlistAdmin } from "./waitlist";

/** The service-role client, typed to the slice waitlist.ts uses. */
export function waitlistAdmin(): WaitlistAdmin {
  return createAdminClient() as unknown as WaitlistAdmin;
}

/** Adds a signed-in, not-yet-allowed account to the waitlist. Best effort: it
 *  never throws or holds up the sign-in. */
export async function recordWaitlist(user: { id?: string | null; email?: string | null }): Promise<void> {
  try {
    await joinWaitlist(waitlistAdmin(), { email: user.email, userId: user.id });
  } catch (e) {
    console.warn("[waitlist] not recorded:", e instanceof Error ? e.message : e);
  }
}

/** Emails the normal Supabase sign-in link (code and link) to an approved
 *  account, through the project's own SMTP. No session and no new secret: the
 *  public anon key, shouldCreateUser false. Resolves false instead of throwing. */
export async function sendApprovalEmail(email: string, origin: string): Promise<boolean> {
  try {
    const client = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin.replace(/\/+$/, "")}/auth/callback?next=%2F` },
    });
    if (error) console.warn("[waitlist] approval email failed:", error.code ?? error.status ?? "error");
    return !error;
  } catch {
    return false;
  }
}
