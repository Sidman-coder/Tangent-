// The /api/chat replies, shared by the route and the Pipeline V2 intake
// (lib/pipeline/intake.ts). Moved here unchanged from app/api/chat/route.ts:
// a Next route file can only export route handlers.

import "server-only";
import { handleVoiceText, type PlanProgress } from "@/lib/voice-handler";
import { extractContextFacts } from "@/lib/context-extract";
import { getUserTimezone } from "@/lib/store";
import { promptDateContext } from "@/lib/time";
import { callClaude, messageText } from "@/lib/ai/call";
import { cacheHistory, withDateLast } from "@/lib/ai/cache";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const PLAN_SYSTEM = `You are TANGENT AI in Plan mode — a thinking partner for planning time.
The student's local date and time are given at the end of their latest message.
In Plan mode you never add, move, or delete anything; you help the user work out what to do and when.
- Ask at most one short clarifying question when something essential (dates, hours per week, deadline) is missing.
- When you propose a schedule, list each session on its own line as "Day, date — time — what", 3 to 10 lines.
- Keep it under 150 words. Plain text only: no markdown headings, bold, tables, JSON, or code fences. Simple "- " bullets are fine.
- End a proposed schedule with: "Switch to Calendar and say \"add this plan\" to put it on your calendar."`;

/** Earlier turns, newest last, trimmed — lets Calendar mode resolve "add this plan". */
export function conversationContext(messages: { role: string; content: string }[]): string | undefined {
  const earlier = messages.slice(0, -1).slice(-4);
  if (earlier.length === 0) return undefined;
  const text = earlier.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  return text.length > 2400 ? text.slice(-2400) : text;
}

export async function planReply(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  // Static system, settled history cached, date last (lib/ai/cache.ts). The
  // history breakpoint only takes effect once a long talk passes the minimum.
  const res = await callClaude("chatPlan", {
    system: PLAN_SYSTEM,
    messages: withDateLast(cacheHistory(messages.slice(-12)), promptDateContext(await getUserTimezone())),
  });
  if (!res.ok) throw new Error(res.budgetExceeded ? res.error : `Anthropic error ${res.status}`);
  const text = messageText(res.message);
  if (!text) throw new Error("Empty plan reply");
  return text.replace(/```[\s\S]*?```/g, "").replace(/\*\*(.+?)\*\*/g, "$1").trim();
}

export function lastUserMessage(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content.trim();
  }
  return "";
}

// Fire-and-forget: extract durable facts about the user from this exchange and
// store them in the rolling context file. Never awaited — must not block the
// response. Runs in-process so it keeps this request's signed-in student (an
// HTTP call to /api/context carried no session cookie and was rejected).
export function extractContextFireAndForget(userMessage: string, finalResponse: string): void {
  void extractContextFacts(`User: ${userMessage}
Assistant: ${finalResponse}`, "chat").catch((e) => {
    console.error("[api/chat] context extraction failed:", e instanceof Error ? e.message : e);
  });
}

/** Calendar mode: run the command through the voice pipeline and describe the result. */
export async function calendarReply(
  messages: { role: "user" | "assistant"; content: string }[],
  userText: string,
  onProgress?: (event: PlanProgress) => void,
  source?: "typed" | "voice"
): Promise<Record<string, unknown>> {
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
  let voiceChangeSet: unknown;
  let voicePreview: unknown;
  try {
    console.log("[api/chat] Calling voice pipeline:", userText);
    const voiceRes = await handleVoiceText(userText, { context: conversationContext(messages), onProgress, preview: true, source });
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
      changeSet?: unknown;
      preview?: unknown;
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
    voiceChangeSet = voiceData.changeSet;
    voicePreview = voiceData.preview;
  } catch (err) {
    console.error("[api/chat] Voice pipeline error:", err);
  }

  if (voiceOk && voiceAction === "confirm_required" && voicePending) {
    return {
      message: voiceResponse.trim(),
      action: voiceAction,
      pending: voicePending,
      ok: true,
    };
  }

  // Pipeline V2 (flag on only): a draft to preview; nothing was saved yet.
  if (voiceOk && voiceAction === "preview" && voiceChangeSet) {
    return {
      message: voiceResponse.trim(),
      action: voiceAction,
      changeSet: voiceChangeSet,
      preview: voicePreview,
      ok: true,
    };
  }

  if (voiceOk && voiceResponse.trim()) {
    console.log("[api/chat] Voice pipeline succeeded, skipping Anthropic rephrase:", voiceResponse.slice(0, 100));
    extractContextFireAndForget(userText, voiceResponse.trim());
    return {
      message: voiceResponse.trim(),
      action: voiceAction,
      actionId: voiceActionId,
      sourcesChecked: voiceSourcesChecked,
      plan: voicePlan,
      recurringCount: voiceAction === "add_recurring_task" ? voiceCount : undefined,
      ok: true,
    };
  }

  // Step 2 — The pipeline did not act. Say so plainly: the previous fallback asked
  // a plain chat model to "confirm it happened", which reported success for
  // tasks that were never created.
  const reason = voiceError || voiceResponse || "the task pipeline did not respond";
  console.error("[api/chat] Voice pipeline did not act:", reason);
  return {
    message: `I couldn't add that to your calendar — ${reason}.`,
    action: "error",
    ok: true,
  };
}
