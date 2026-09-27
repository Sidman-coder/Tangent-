import { NextResponse } from "next/server";
import { resetUserData } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deletes all of the signed-in student's data (never anyone else's — the
 *  store scopes every delete to the session user). The body must carry
 *  { confirm: "RESET" } so a stray request can't wipe an account. */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== "RESET") {
    return NextResponse.json({ ok: false, error: "Confirmation required." }, { status: 400 });
  }
  try {
    await resetUserData();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/reset] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't delete your data. Try again." }, { status: 500 });
  }
});
