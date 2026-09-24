import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CHAT_SYSTEM = `You are TANGENT AI, a friendly productivity assistant.
NEVER return JSON in your response. NEVER use backticks or code blocks. Always respond in plain English only. Keep responses under 40 words.
Never return JSON. Never use backticks or code blocks. Never use markdown formatting.
The command has already been executed. Just confirm it happened naturally.
Examples:
"Done! Your meeting has been added for tomorrow at 2pm."
"Your workout plan is all set for this week!"
"Schedule cleared! Starting fresh."
"Got it! I have added that to your calendar."
"I have marked that task as complete."`;

function cleanResponse(text: string, fallback: string): string {
  if (!text) return fallback || "Done!";
  let clean = text.replace(/```[\s\S]*?```/gi, "").trim();
  if (
    clean.startsWith("{") ||
    clean.includes('"action"') ||
    clean.includes('"tasks"') ||
    clean.includes('"planTitle"')
  ) {
    return fallback || "Done! Your request has been processed.";
  }
  return clean;
}

function lastUserMessage(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content.trim();
  }
  return "";
}

// Fire-and-forget: extract durable facts about the user from this exchange and
// store them in the rolling context file. Never awaited — must not block the response.
function extractContextFireAndForget(baseUrl: string, userMessage: string, finalResponse: string): void {
  const contextPromise = fetch(`${baseUrl}/api/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "extract",
      conversation: `User: ${userMessage}\nAssistant: ${finalResponse}`,
      source: "chat",
    }),
  }).catch(() => {});

  void contextPromise;
}

export async function POST(req: Request) {
  try {
    console.log("[api/chat] === CHAT REQUEST START ===");
    const body = (await req.json()) as { messages?: unknown };
    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing messages array" }, { status: 400 });
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of raw) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
        messages.push({ role, content: content.trim() });
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid messages" }, { status: 400 });
    }

    const userText = lastUserMessage(messages);
    if (!userText) {
      return NextResponse.json({ ok: false, error: "No user message" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY on the server." }, { status: 401 });
    }

    console.log("[api/chat] User message:", userText);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Step 1 — Execute command via voice pipeline
    let voiceResponse = "";
    let voiceAction = "";
    let voiceOk = false;
    let voiceActionId: string | undefined;
    let voicePending: { id: string; kind: string; message: string } | undefined;
    let voiceSourcesChecked: string[] | undefined;
    try {
      console.log("[api/chat] Calling voice pipeline:", userText);
      const voiceRes = await fetch(`${baseUrl}/api/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });
      const voiceData = (await voiceRes.json()) as {
        response?: string;
        action?: string;
        ok?: boolean;
        actionId?: string;
        pending?: { id: string; kind: string; message: string };
        sourcesChecked?: string[];
      };
      console.log("[api/chat] Voice pipeline result:", JSON.stringify(voiceData).slice(0, 300));
      voiceResponse = voiceData.response ?? "";
      voiceAction = voiceData.action ?? "";
      voiceOk = voiceData.ok === true;
      voiceActionId = voiceData.actionId;
      voicePending = voiceData.pending;
      voiceSourcesChecked = voiceData.sourcesChecked;
    } catch (err) {
      console.error("[api/chat] Voice pipeline error:", err);
    }

    if (voiceOk && voiceAction === "confirm_required" && voicePending) {
      return NextResponse.json({
        message: voiceResponse.trim(),
        action: voiceAction,
        pending: voicePending,
        ok: true,
      });
    }

    if (voiceOk && voiceResponse.trim()) {
      console.log("[api/chat] Voice pipeline succeeded, skipping Anthropic rephrase:", voiceResponse.slice(0, 100));
      extractContextFireAndForget(baseUrl, userText, voiceResponse.trim());
      return NextResponse.json({
        message: voiceResponse.trim(),
        action: voiceAction,
        actionId: voiceActionId,
        sourcesChecked: voiceSourcesChecked,
        ok: true,
      });
    }

    // Step 2 — Get friendly AI confirmation from Anthropic
    console.log("[api/chat] Calling Anthropic for friendly response...");
    let aiMessage = voiceResponse || "Done! Your request has been processed.";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        temperature: 0.3,
        system: CHAT_SYSTEM,
        messages,
      }),
    });

    if (anthropicRes.ok) {
      const anthropicData = (await anthropicRes.json()) as {
        content?: { type: string; text: string }[];
      };
      if (anthropicData.content?.[0]?.text) {
        aiMessage = anthropicData.content[0].text;
        console.log("[api/chat] Anthropic friendly response:", aiMessage.slice(0, 100));
      }
    } else {
      console.error("[api/chat] Anthropic error:", anthropicRes.status);
    }

    const finalMessage = cleanResponse(aiMessage, voiceResponse || "Done!");
    console.log("[api/chat] Final message to user:", finalMessage);

    extractContextFireAndForget(baseUrl, userText, finalMessage);

    return NextResponse.json({
      message: finalMessage,
      action: voiceAction,
      ok: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
