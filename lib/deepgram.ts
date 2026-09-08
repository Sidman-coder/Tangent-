// lib/deepgram.ts
//
// PLACEHOLDER STT PROVIDER — Deepgram nova-2, added per explicit user instruction
// even though DEEPGRAM_API_KEY is not yet configured. To swap providers later,
// replace the body of transcribeAudio() below (see SETUP_GMAIL_CANVAS.md for
// details on which env var to change and where).

/** Transcribes a raw audio buffer via Deepgram's nova-2 model. Requires DEEPGRAM_API_KEY. */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPGRAM_API_KEY in .env.local");
  }

  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram transcription failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return transcript.trim();
}
