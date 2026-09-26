import { NextResponse } from "next/server";
import { getState, replaceState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";

async function GETHandler() {
  return NextResponse.json(getState());
}

async function PUTHandler(req: Request) {
  try {
    const body = (await req.json()) as AppState;
    replaceState(body);
    return NextResponse.json({ ok: true, state: getState() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const GET = withWorkspaceRoute(GETHandler);
export const PUT = withWorkspaceRoute(PUTHandler);
