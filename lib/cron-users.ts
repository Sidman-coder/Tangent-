import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAsUser } from "@/lib/request-context";
import { isEmailAllowed } from "@/lib/auth/access";

export type CronUserResult<T> = { userId: string; ok: boolean; result?: T; error?: string };

/** Runs a cron job once per student, each inside its own runAsUser() context.
 *  Only students who finished onboarding and are still on the allowlist are
 *  included. One student's failure is logged and doesn't stop the others. */
export async function forEachCronUser<T>(job: string, fn: () => Promise<T>): Promise<CronUserResult<T>[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, email")
    .not("onboarded_at", "is", null)
    .order("created_at");
  if (error) throw new Error(`[cron/${job}] listing students failed: ${error.message}`);

  const users = (data ?? []).filter((p: { email: string }) => isEmailAllowed(p.email));
  const results: CronUserResult<T>[] = [];
  for (const { user_id: userId } of users as { user_id: string }[]) {
    try {
      results.push({ userId, ok: true, result: await runAsUser(userId, fn) });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`[cron/${job}] failed for ${userId}:`, message);
      results.push({ userId, ok: false, error: message });
    }
  }
  console.log(`[cron/${job}] ran for ${results.length} student(s), ${results.filter((r) => !r.ok).length} failed`);
  return results;
}
