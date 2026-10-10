import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { listOpenDrafts } from "@/lib/pipeline/card-actions";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import { draftFromPlanText } from "@/lib/pipeline/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pipeline V2 (404 while TANGENT_PIPELINE_V2 is off): open drafts from the
 *  last 24 hours, newest first; older drafts are discarded as expired. */
export const GET = withUser(listOpenDrafts);

/** Pipeline V2: "Add plan to calendar" on a chat reply. Body { text, request }:
 *  the reply as shown and the message that asked for it. Drafts exactly the
 *  shown lines; nothing is written until the card is confirmed. */
export const POST = withUser(async (req: Request) => {
  if (!TANGENT_PIPELINE_V2) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown; request?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text.slice(0, 20000) : "";
    const request = typeof body?.request === "string" ? body.request : "";
    if (!text.trim()) return NextResponse.json({ ok: false, message: "Missing text" }, { status: 400 });
    const res = await draftFromPlanText(text, request);
    if ("error" in res) return NextResponse.json({ ok: false, message: res.error }, { status: 422 });
    return res;
  } catch (e) {
    console.error("[changesets] plan text:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "Something went wrong. Nothing was changed." }, { status: 500 });
  }
});
