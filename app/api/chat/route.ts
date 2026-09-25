import { NextResponse } from "next/server";
import { handleVoiceText } from "@/lib/voice-handler";

export const dynamic = "force-dynamic";

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
type ChatMode = "plan" | "calendar";

const PLAN_SYSTEM = (today: string) => `You are TANGENT AI in Plan mode — a thinking partner for planning time.
Today is ${today}.
In Plan mode you never add, move, or delete anything; you help the user work out what to do and when.
- Ask at most one short clarifying question when something essential (dates, hours per week, deadline) is missing.
- When you propose a schedule, list each session on its own line as "Day, date — time — what", 3 to 10 lines.
- Keep it under 150 words. Plain text only: no markdown headings, bold, tables, JSON, or code fences. Simple "- " bullets are fine.
- End a proposed schedule with: "Switch to Calendar and say \"add this plan\" to put it on your calendar."`;

/** Earlier turns, newest last, trimmed — lets Calendar mode resolve "add this plan". */
function conversationContext(messages: { role: string; content: string }[]): string | undefined {
  const earlier = messages.slice(0, -1).slice(-4);
  if (earlier.length === 0) return undefined;
  const text = earlier.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  return text.length > 2400 ? text.slice(-2400) : text;
}

async function planReply(apiKey: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 700,
      temperature: 0.4,
      system: PLAN_SYSTEM(new Date().toISOString().slice(0, 10)),
      messages: messages.slice(-12),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
  if (!text) throw new Error("Empty plan reply");
  return text.replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
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
    const body = (await req.json()) as { messages?: unknown; mode?: unknown };
    const mode: ChatMode = body.mode === "plan" ? "plan" : "calendar";
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

    if (mode === "plan") {
      const reply = await planReply(apiKey, messages);
      return NextResponse.json({ message: reply, action: "plan_reply", mode, ok: true });
    }

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
      const voiceRes = await handleVoiceText(userText, { context: conversationContext(messages) });
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
