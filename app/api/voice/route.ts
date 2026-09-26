import { NextResponse } from "next/server";
import { getAppState } from "@/lib/store";
import { handleVoiceText } from "@/lib/voice-handler";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
// Voice runs the same multi-turn tool loop as calendar chat.
export const maxDuration = 60;

async function POSTHandler(req: Request) {
  const body = (await req.json()) as { text?: string; transcript?: string };
  const text = (body.text ?? body.transcript ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }
  return handleVoiceText(text);
}

async function GETHandler() {
  return NextResponse.json({ ok: true, state: getAppState() });
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const POST = withWorkspaceRoute(POSTHandler);
export const GET = withWorkspaceRoute(GETHandler);
