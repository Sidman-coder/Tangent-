import { NextResponse } from "next/server";
import { exportUserData } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: everything the signed-in student owns, as one JSON download. Built on
 *  the server so secrets (the Canvas feed link, pen keys) are dropped before
 *  anything leaves; see lib/settings/data-export.ts. */
export const GET = withUser(async () => {
  try {
    const tables = await exportUserData();
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), app: "Tangent", tables }, null, 2);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="tangent-export-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/export] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't build your export. Try again." }, { status: 500 });
  }
});
