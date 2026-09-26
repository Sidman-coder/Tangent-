import { NextResponse } from "next/server";
import { getAppState, getRecentActions, undoAction } from "@/lib/store";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

/** GET recent action receipts (for a future "recent activity" list). */
async function GETHandler() {
  return NextResponse.json({ ok: true, actions: getRecentActions(20) });
}

/** POST { id } to undo a previously recorded action. */
async function POSTHandler(req: Request) {
  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
    }
    const result = undoAction(body.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 422 });
    }
    return NextResponse.json({ ok: true, message: result.message, state: getAppState() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const GET = withWorkspaceRoute(GETHandler);
export const POST = withWorkspaceRoute(POSTHandler);
