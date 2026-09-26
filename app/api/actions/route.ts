import { NextResponse } from "next/server";
import { getAppState, getRecentActions, undoAction } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET recent action receipts (for a future "recent activity" list). */
export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, actions: await getRecentActions(20) });
});

/** POST { id } to undo a previously recorded action. */
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
    }
    const result = await undoAction(body.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
    }
    return NextResponse.json({ ok: true, message: result.message, state: await getAppState() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
});
