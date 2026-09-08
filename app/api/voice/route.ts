import { NextResponse } from "next/server";
import { getAppState } from "@/lib/store";
import { handleVoiceText } from "@/lib/voice-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; transcript?: string };
  const text = (body.text ?? body.transcript ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });
  }
  return handleVoiceText(text);
}

export async function GET() {
  return NextResponse.json({ ok: true, state: getAppState() });
}
