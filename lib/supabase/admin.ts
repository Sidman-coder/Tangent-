import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses Row Level Security, so every query made with
 *  it MUST set/filter user_id explicitly. Server-only: the "server-only" import
 *  fails the build if this module is ever pulled into a client bundle.
 *
 *  Only trusted server processes use this (cron jobs looping over students).
 *  Request handlers use the session client from lib/supabase/server.ts. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
