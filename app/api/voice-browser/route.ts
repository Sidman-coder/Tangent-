import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/deepgram";
import { handleVoiceText } from "@/lib/voice-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ ok: false, error: "Missing audio file" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    console.log("[api/voice-browser] Received audio:", buffer.length, "bytes,", mimeType);

    const text = await transcribeAudio(buffer, mimeType);
    console.log("[api/voice-browser] Transcribed text:", text);

    if (!text) {
      return NextResponse.json({ ok: false, error: "Could not transcribe audio" }, { status: 422 });
    }

    // Browser capture only transcribes: the text goes back into an editable
    // input so the student can fix mishearings before anything is submitted.
    if (formData.get("mode") === "transcribe") {
      return NextResponse.json({ ok: true, text });
    }

    return handleVoiceText(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/voice-browser] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
