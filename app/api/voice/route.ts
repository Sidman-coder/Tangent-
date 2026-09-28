import { NextResponse } from "next/server";
import { getAppState } from "@/lib/store";
import { handleVoiceText } from "@/lib/voice-handler";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Voice runs the same multi-turn tool loop as calendar chat.
export const maxDuration = 60;

export const POST = withUser(async (req: Request) => {
  const body = (await req.json()) as { text?: string; transcript?: string };
  const text = (body.text ?? body.transcript ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }
  return handleVoiceText(text);
});

export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, state: await getAppState() });
});
