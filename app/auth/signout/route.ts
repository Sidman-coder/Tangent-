import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // "Sign out of all devices" in Settings posts scope=global, which ends every
  // session for this account; the default ends only this one.
  const form = await request.formData().catch(() => null);
  const scope = form?.get("scope") === "global" ? "global" : "local";
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope });
  if (error) console.warn("[auth/signout] Supabase sign-out failed; clearing cookies anyway:", error.message);
  // 303 so the browser follows with a GET after the form POST.
  const res = NextResponse.redirect(new URL("/signin", request.url), { status: 303 });
  // signOut() keeps the session cookie when the Supabase call fails, so drop
  // every Supabase auth cookie here too, and the browser's cached pages.
  cookies()
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .forEach((c) => res.cookies.set(c.name, "", { path: "/", maxAge: 0 }));
  res.headers.set("Clear-Site-Data", '"cache"');
  return res;
}
