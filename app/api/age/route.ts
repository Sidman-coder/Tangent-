import { NextResponse } from "next/server";
import { getRequestContext, withUser } from "@/lib/request-context";
import { parseAgeAnswer } from "@/lib/auth/age";
import { markUnder13 } from "@/lib/auth/password-server";
import { UNDER_13_PATH } from "@/lib/auth/gate";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The age answer from the first onboarding screen. 13 and up: nothing is
// stored. Under 13: app_metadata.under_13 = true (service role, so the student
// can't undo it), and middleware sends every page to /not-yet from then on.
export const POST = withUser(async (req: Request) => {
  const answer = parseAgeAnswer(await req.json().catch(() => null));
  if (!answer.ok) return NextResponse.json({ ok: false, error: answer.error }, { status: 400 });
  if (!answer.under13) return NextResponse.json({ ok: true });
  try {
    await markUnder13(getRequestContext().userId);
  } catch (e) {
    logServerError("api/age", e);
    return NextResponse.json({ ok: false, error: "Couldn't save that. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, next: UNDER_13_PATH });
});
