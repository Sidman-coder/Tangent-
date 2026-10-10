import { NextResponse } from "next/server";
import { handleVoiceText, type PlanProgress } from "@/lib/voice-handler";
import { withUser } from "@/lib/request-context";
import { extractContextFacts } from "@/lib/context-extract";
import { addTask, getUserTimezone, recordAction, setCapacity } from "@/lib/store";
import { quickCapture, type QuickCapture } from "@/lib/ai/router";
import { inferCalendarGroup } from "@/lib/calendars";
import { dayName } from "@/lib/load";
import { formatTime12 } from "@/lib/dates";
import { CAPACITY_QUESTION, capacityFromAnswer, clarifyQuestions, shouldConsiderClarifying } from "@/lib/ai/clarify";
import { buildStudentContext } from "@/lib/ai/student-context";
import { placeNewTask, reliefSuggestion } from "@/lib/spacing";
import { addDaysYMD, localNow, promptDateContext } from "@/lib/time";
import { callClaude, messageText } from "@/lib/ai/call";
import { cacheHistory, withDateLast } from "@/lib/ai/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Calendar mode runs a multi-turn Claude tool loop; measured at ~48s in
// production. With no maxDuration declared, the platform default killed it
// partway through and the console blamed a missing API key.
export const maxDuration = 60;

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
type ChatMode = "plan" | "calendar";

const PLAN_SYSTEM = `You are TANGENT AI in Plan mode — a thinking partner for planning time.
The student's local date and time are given at the end of their latest message.
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

async function planReply(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
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

function lastUserMessage(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content.trim();
  }
  return "";
}

// Fire-and-forget: extract durable facts about the user from this exchange and
// store them in the rolling context file. Never awaited — must not block the
// response. Runs in-process so it keeps this request's signed-in student (an
// HTTP call to /api/context carried no session cookie and was rejected).
function extractContextFireAndForget(userMessage: string, finalResponse: string): void {
  void extractContextFacts(`User: ${userMessage}
Assistant: ${finalResponse}`, "chat").catch((e) => {
    console.error("[api/chat] context extraction failed:", e instanceof Error ? e.message : e);
  });
}

/** Saves a quick capture: spacing brain for the when, no model. */
async function saveQuickCapture(quick: QuickCapture): Promise<Record<string, unknown>> {
  const placed = await placeNewTask({ date: quick.date ?? null, time: quick.time ?? null, deadline: quick.deadline ?? null });
  const task = await addTask({
    title: quick.title,
    date: placed.date,
    time: placed.time,
    completed: false,
    calendarId: inferCalendarGroup(quick.title),
  });
  if (task.wasDuplicate) {
    return { ok: true, action: "add_task", message: `Already have "${task.title}" around then.` };
  }
  const record = await recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
  const tz = await getUserTimezone();
  const today = localNow(tz).date;
  const day =
    task.date === today ? "today" : task.date === addDaysYMD(today, 1) ? "tomorrow" : `${dayName(task.date)}`;
  return {
    ok: true,
    action: "add_task",
    message: `Added ${task.title} for ${day} at ${formatTime12(task.time)}.${placed.note ? ` ${placed.note}` : ""}`,
    actionId: record.id,
    taskId: task.id,
    quick: true,
    suggestion: await reliefSuggestion(),
  };
}

type Answer = { id: string; question: string; answer: string };

function parseAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Answer =>
      !!a && typeof a === "object" &&
      typeof (a as Answer).id === "string" &&
      typeof (a as Answer).question === "string" &&
      typeof (a as Answer).answer === "string" &&
      (a as Answer).answer.trim().length > 0
    )
    .slice(0, 4)
    .map((a) => ({ id: a.id, question: a.question.slice(0, 200), answer: a.answer.trim().slice(0, 300) }));
}

/** Calendar mode: run the command through the voice pipeline and describe the result. */
async function calendarReply(
  messages: { role: "user" | "assistant"; content: string }[],
  userText: string,
  onProgress?: (event: PlanProgress) => void
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
  let voiceTaskId: string | undefined;
  try {
    console.log("[api/chat] Calling voice pipeline:", userText);
    const voiceRes = await handleVoiceText(userText, { context: conversationContext(messages), onProgress });
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
      task?: { id?: string };
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
    voiceTaskId = voiceData.task?.id;
    voiceSourcesChecked = voiceData.sourcesChecked;
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

  if (voiceOk && voiceResponse.trim()) {
    console.log("[api/chat] Voice pipeline succeeded, skipping Anthropic rephrase:", voiceResponse.slice(0, 100));
    extractContextFireAndForget(userText, voiceResponse.trim());
    // New work can tip a day over the student's load: offer one move, never
    // make it (the student taps to accept; /api/reschedule records Undo).
    const suggestion =
      voiceAction === "add_task" || voiceAction === "create_plan" ? await reliefSuggestion() : null;
    return {
      message: voiceResponse.trim(),
      suggestion,
      // So the client can ask for follow-up questions about it (/api/questions).
      taskId: voiceAction === "add_task" ? voiceTaskId : undefined,
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

export const POST = withUser(async (req: Request) => {
  try {
    console.log("[api/chat] === CHAT REQUEST START ===");
    const body = (await req.json()) as {
      messages?: unknown;
      mode?: unknown;
      stream?: unknown;
      /** Opt in to "grill me" questions (the AI page does; capture never does). */
      clarify?: unknown;
      /** Answers to questions from a previous clarify reply. */
      answers?: unknown;
      /** From the capture mic or Cmd-K: a plain to-do saves without a model. */
      capture?: unknown;
    };
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
      const reply = await planReply(messages);
      return NextResponse.json({ message: reply, action: "plan_reply", mode, ok: true });
    }

    // Instant capture: a plain to-do is saved straight away — no model in the
    // way — and polished a moment later by /api/questions (enrich). Anything
    // that might be a command goes through the full pipeline below.
    if (body.capture === true && messages.length === 1) {
      const quick = quickCapture(userText, await getUserTimezone());
      if (quick) return NextResponse.json(await saveQuickCapture(quick));
    }

    // Answers to Tangent's questions ride along with the original request, so
    // the pipeline sees one complete ask. A capacity answer is saved for good.
    const answers = parseAnswers(body.answers);
    let pipelineText = userText;
    if (answers.length > 0) {
      for (const a of answers) {
        if (a.id !== CAPACITY_QUESTION.id) continue;
        const weekday = capacityFromAnswer(a.answer);
        if (weekday) await setCapacity({ weekday, weekend: Math.min(720, Math.round(weekday * 1.6)) });
      }
      pipelineText = `${userText}\n\nMy answers to your questions:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`;
    } else if (body.clarify === true && shouldConsiderClarifying(userText)) {
      const picture = await buildStudentContext().catch(() => null);
      const questions = picture
        ? await clarifyQuestions(userText, picture.text, { askCapacity: !picture.capacityKnown }).catch(() => [])
        : [];
      if (questions.length > 0) {
        const reply = { ok: true, action: "clarify", message: "A few quick questions so this fits you.", questions };
        if (body.stream !== true) return NextResponse.json(reply);
        return new Response(JSON.stringify({ type: "result", ...reply }) + "\n", {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    if (body.stream !== true) return NextResponse.json(await calendarReply(messages, pipelineText));

    // Streamed: one JSON object per line. Plan progress ({type:"plan_outline"},
    // {type:"plan_task"}) as it's generated, then {type:"result", ...} with the
    // same fields as the non-streamed reply. Tasks are only saved at the end.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: unknown) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        try {
          const result = await calendarReply(messages, pipelineText, send);
          send({ type: "result", ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          console.error("[api/chat] Unhandled error:", message);
          send({ type: "result", ok: false, error: message });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
