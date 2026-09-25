import { NextResponse } from "next/server";
import { handleVoiceText } from "@/lib/voice-handler";

export const dynamic = "force-dynamic";

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

    // Same-origin base for fire-and-forget helpers — derived from the request so it
    // works on any port and on Vercel, never a hardcoded localhost.
    const baseUrl = new URL(req.url).origin;

    // Step 1 — Execute command via voice pipeline. Called in-process: the old
    // HTTP self-call to NEXT_PUBLIC_BASE_URL failed whenever the app wasn't on
    // localhost:3000 (Vercel, another port), silently degrading to plain chat.
    let voiceResponse = "";
    let voiceAction = "";
    let voiceOk = false;
    let voiceError = "";
    let voiceActionId: string | undefined;
    let voicePending: { id: string; kind: string; message: string } | undefined;
    let voiceSourcesChecked: string[] | undefined;
    let voicePlan: { id: string; title: string; taskCount: number; color: string } | undefined;
    let voiceCount: number | undefined;
    try {
      console.log("[api/chat] Calling voice pipeline:", userText);
      const voiceRes = await handleVoiceText(userText);
      const voiceData = (await voiceRes.json()) as {
        response?: string;
        action?: string;
        ok?: boolean;
        error?: string;
        actionId?: string;
        pending?: { id: string; kind: string; message: string };
        sourcesChecked?: string[];
        plan?: { id: string; title: string; taskCount: number; color: string };
        count?: number;
      };
      console.log("[api/chat] Voice pipeline result:", JSON.stringify(voiceData).slice(0, 300));
      voiceResponse = voiceData.response ?? "";
      voiceAction = voiceData.action ?? "";
      voiceOk = voiceData.ok === true;
      voiceError = voiceData.error ?? "";
      voiceActionId = voiceData.actionId;
      voicePending = voiceData.pending;
      voicePlan = voiceData.plan;
      voiceCount = voiceData.count;
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
        plan: voicePlan,
        recurringCount: voiceAction === "add_recurring_task" ? voiceCount : undefined,
        ok: true,
      });
    }

    // Step 2 — The pipeline did not act. Say so plainly: the previous fallback asked
    // a plain chat model to "confirm it happened", which reported success for
    // tasks that were never created.
    const reason = voiceError || voiceResponse || "the task pipeline did not respond";
    console.error("[api/chat] Voice pipeline did not act:", reason);
    return NextResponse.json({
      message: `I couldn't add that to your calendar — ${reason}.`,
      action: "error",
      ok: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
