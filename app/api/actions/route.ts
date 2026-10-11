import { NextResponse } from "next/server";
import { getActionsByIds, getAppState, getRecentActions, undoAction } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET the signed-in student's recent action receipts (Recent changes, newest
 * first), or ?ids=a,b to re-check specific ones (Undo on a reopened chat).
 * Always scoped to the student: other students' ids are just not returned.
 */
export const GET = withUser(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const ids = params.get("ids");
  const actions =
    ids !== null
      ? await getActionsByIds(ids.split(",").map((s) => s.trim()).filter((s) => UUID.test(s)))
      : await getRecentActions(Number(params.get("limit")) || 20);
  // Snapshots hold copies of task data the client never needs.
  return NextResponse.json({ ok: true, actions: actions.map(({ snapshot: _snapshot, ...rest }) => rest) });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
