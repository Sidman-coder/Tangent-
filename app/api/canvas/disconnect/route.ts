import { NextResponse } from "next/server";
import { disconnectCanvas } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Overnight 2, Phase 6 (Sid approved): Disconnect Canvas. The feed link is
 *  always deleted; the Canvas items go too only with `removeItems: true`. */
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json().catch(() => ({}))) as { removeItems?: unknown };
    const result = await disconnectCanvas({ removeItems: body.removeItems === true });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[api/canvas/disconnect] POST error:", e instanceof Error ? e.name : "error");
    return NextResponse.json({ ok: false, error: "Canvas could not be disconnected. Try again." }, { status: 500 });
  }
});
