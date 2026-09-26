import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. Anon key only — never import
 *  lib/supabase/admin.ts from client code. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
