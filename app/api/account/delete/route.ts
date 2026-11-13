import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withUser, getRequestContext } from "@/lib/request-context";
import { resetUserData } from "@/lib/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runAccountDelete, type AdminClient } from "@/lib/account/delete-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deletes the signed-in student's data and their sign-in (Round 5A, 1.4).
 *  Who is deleted comes only from the session. The body must carry
 *  { confirm: "DELETE" }; anything else in it is ignored. The service-role key
 *  is used here, on the server, and nowhere else in this flow. */
export const POST = withUser(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { userId, email } = getRequestContext();
  const result = await runAccountDelete(body, {
    session: { userId, email },
    resetData: resetUserData,
    admin: createAdminClient() as unknown as AdminClient,
  });
  const res = NextResponse.json(result.body, { status: result.status });
  if (result.status === 200) {
    // The auth user is gone; end this browser's session too (as /auth/signout does).
    await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    cookies()
      .getAll()
      .filter((c) => c.name.startsWith("sb-"))
      .forEach((c) => res.cookies.set(c.name, "", { path: "/", maxAge: 0 }));
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
});
