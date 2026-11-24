import { NextResponse } from "next/server";
import { markOpened } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { kind: "project" | "tangent", id } — the student opened it, so the
 *  sidebar can list what they actually use. Before the migration runs this is
 *  a quiet no-op ({ ok: false }), never an error the page has to handle. */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown };
  if ((body.kind !== "project" && body.kind !== "tangent") || typeof body.id !== "string") {
    return NextResponse.json({ ok: false, error: "kind must be project or tangent, with an id" }, { status: 400 });
  }
  const saved = await markOpened(body.kind, body.id);
  return NextResponse.json({ ok: saved });
});
