import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { perfFetch } from "@/lib/perf";

/** Supabase client for Server Components, Route Handlers and Server Actions.
 *  Uses the anon key + the student's session cookie, so Row Level Security
 *  applies to every query. */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: perfFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  );
}
