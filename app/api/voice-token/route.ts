import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live capture streams audio from the browser straight to Deepgram, so words
// appear while the student is still talking. The browser can't hold
// DEEPGRAM_API_KEY, so this trades it for a short-lived access token (Deepgram's
// /v1/auth/grant, 30s TTL by default — only needed to open the socket). Any
// failure here is fine: useVoiceCapture falls back to record-then-upload
// through /api/voice-browser.
export const POST = withUser(async () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "DEEPGRAM_API_KEY is missing" }, { status: 503 });
  }
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Deepgram grant failed: ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      return NextResponse.json({ ok: false, error: "Deepgram returned no token" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, token: data.access_token });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
});
