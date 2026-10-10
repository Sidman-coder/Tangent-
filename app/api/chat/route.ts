import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { calendarReply, lastUserMessage, planReply } from "@/lib/chat-reply";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import { handleRequest } from "@/lib/pipeline/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Calendar mode runs a multi-turn Claude tool loop; measured at ~48s in
// production. With no maxDuration declared, the platform default killed it
// partway through and the console blamed a missing API key.
export const maxDuration = 60;

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
type ChatMode = "plan" | "calendar";

export const POST = withUser(async (req: Request) => {
  try {
    console.log("[api/chat] === CHAT REQUEST START ===");
    const body = (await req.json()) as { messages?: unknown; mode?: unknown; stream?: unknown; route?: unknown };
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

    // Pipeline V2: one box, no mode. Every message goes through the intake
    // (lib/pipeline/intake.ts); route "chat" is the "Just talking" re-ask.
    // Flag off: the Plan/Calendar switch decides, as before.
    const reply = TANGENT_PIPELINE_V2
      ? (onProgress?: Parameters<typeof calendarReply>[2]) =>
          handleRequest(messages, { onProgress, route: body.route === "chat" ? "chat" : undefined })
      : (onProgress?: Parameters<typeof calendarReply>[2]) => calendarReply(messages, userText, onProgress);

    if (!TANGENT_PIPELINE_V2 && mode === "plan") {
      const text = await planReply(messages);
      return NextResponse.json({ message: text, action: "plan_reply", mode, ok: true });
    }

    if (body.stream !== true) return NextResponse.json(await reply());

    // Streamed: one JSON object per line. Plan progress ({type:"plan_outline"},
    // {type:"plan_task"}) as it's generated, then {type:"result", ...} with the
    // same fields as the non-streamed reply. Tasks are only saved at the end.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: unknown) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        try {
          const result = await reply(send);
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
