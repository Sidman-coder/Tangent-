import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AttemptLimiter, hasPasswordFlag } from "./password";

// One limiter per server instance for every password check (sign-in and the
// "current password" in Settings).
const globalLimiter = globalThis as unknown as { __tangentPasswordLimiter?: AttemptLimiter };
export const passwordLimiter = (globalLimiter.__tangentPasswordLimiter ??= new AttemptLimiter());

/** Whether the invited account behind `email` has a Tangent password. Uses the
 *  service role because the student isn't signed in yet; reads only the flag.
 *  No account reads as no password. */
export async function accountHasPassword(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) return false;
  const { data: found } = await admin.auth.admin.getUserById(userId);
  return hasPasswordFlag(found.user?.app_metadata);
}

/** For the Create account tab: the account behind `email`, if any, with when it
 *  was made and whether it has a password. Service role, reads only those. */
export async function findAccount(email: string): Promise<{ createdAt: string | null; passwordSet: boolean } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
  if (error) throw new Error(`profiles lookup failed: ${error.code ?? "error"}`);
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) return null;
  const { data: found } = await admin.auth.admin.getUserById(userId);
  if (!found.user) return null;
  return { createdAt: found.user.created_at ?? null, passwordSet: hasPasswordFlag(found.user.app_metadata) };
}

/** Flags the account in app_metadata, which the student can't edit. */
/** Marks the account under 13 (the first onboarding answer). app_metadata is
 *  service-role only, so the student can't clear it; middleware reads it. */
export async function markUnder13(userId: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: { under_13: true } });
  if (error) throw new Error(`under_13 flag not saved: ${error.code ?? error.status ?? "error"}`);
}

export async function markPasswordSet(userId: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: { password_set: true } });
  if (error) {
    console.warn("[auth/password] couldn't flag the account:", error.code ?? error.status ?? "error");
    throw new Error("password flag not saved");
  }
}
