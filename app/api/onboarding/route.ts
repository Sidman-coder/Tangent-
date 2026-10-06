import { NextResponse } from "next/server";
import { completeOnboarding, restartOnboarding, getState, updatePreferences } from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { parsePreferencesPatch, parseSubmission } from "@/lib/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Finishes the first-run flow: the one server save for every answer, the
 *  timezone, and the School block (replaced, never duplicated). */
export const POST = withUser(async (req: Request) => {
  const parsed = parseSubmission(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const user = await completeOnboarding(parsed.value);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error("[api/onboarding] POST error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't save your setup. Try again." }, { status: 500 });
  }
});

/** Changes individual answers (Settings), or clears the starting intent once
 *  the student has used or dismissed it. Only known fields and values. */
export const PATCH = withUser(async (req: Request) => {
  const parsed = parsePreferencesPatch(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const user = await updatePreferences(parsed.value);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error("[api/onboarding] PATCH error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't save that change." }, { status: 500 });
  }
});

/** "Redo setup" in Settings: the first-run flow shows on next load, with the
 *  saved answers prefilled. Nothing is deleted here. */
export const DELETE = withUser(async () => {
  try {
    await restartOnboarding();
    return NextResponse.json({ ok: true, state: await getState() });
  } catch (e) {
    console.error("[api/onboarding] DELETE error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't restart setup." }, { status: 500 });
  }
});
