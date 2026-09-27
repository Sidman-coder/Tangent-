import { NextResponse } from "next/server";
import { completeOnboarding, restartOnboarding, getState } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finishes the first-run flow: saves the student's answers and timezone. */
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      displayName?: unknown;
      isHighSchool?: unknown;
      timezone?: unknown;
    };
    const user = await completeOnboarding({
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      isHighSchool: typeof body.isHighSchool === "boolean" ? body.isHighSchool : null,
      timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error("[api/onboarding] POST error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't save your setup. Try again." }, { status: 500 });
  }
});

/** "Restart setup" in Settings: the first-run flow shows on next load. */
export const DELETE = withUser(async () => {
  try {
    await restartOnboarding();
    return NextResponse.json({ ok: true, state: await getState() });
  } catch (e) {
    console.error("[api/onboarding] DELETE error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't restart setup." }, { status: 500 });
  }
});
