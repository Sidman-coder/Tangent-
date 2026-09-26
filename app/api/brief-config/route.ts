import { NextResponse } from "next/server";
import { getBriefConfig, saveBriefConfig } from "@/lib/store";
import type { BriefConfig } from "@/lib/types";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

async function GETHandler() {
  return NextResponse.json({ ok: true, config: getBriefConfig() });
}

async function POSTHandler(req: Request) {
  try {
    const body = (await req.json()) as BriefConfig;
    if (!Array.isArray(body.sources) || !body.cadence || !body.deliveryTime) {
      return NextResponse.json({ ok: false, error: "Invalid brief config" }, { status: 400 });
    }
    const saved = saveBriefConfig(body);
    return NextResponse.json({ ok: true, config: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const GET = withWorkspaceRoute(GETHandler);
export const POST = withWorkspaceRoute(POSTHandler);
