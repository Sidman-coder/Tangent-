import { NextResponse } from "next/server";
import { getTaskChat, addTaskChatMessage, getAllTasks } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "Missing taskId" }, { status: 400 });
  }
  const history = getTaskChat(taskId);
  console.log("[api/task-chat] GET taskId:", taskId, "| history length:", history.length);
  return NextResponse.json({ ok: true, history });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { taskId?: string; message?: string };
    const { taskId, message } = body;

    if (!taskId || !message?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing taskId or message" }, { status: 400 });
    }

    console.log("[api/task-chat] POST taskId:", taskId, "| message:", message.trim().slice(0, 80));

    // Read task from the persistent global store — does NOT modify tasks array
    const tasks = getAllTasks();
    console.log("[api/task-chat] Task store size at this call:", tasks.length);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      console.error("[api/task-chat] Task not found:", taskId, "| Available IDs:", tasks.map(t => t.id).join(", "));
      return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    }

    console.log("[api/task-chat] Found task:", task.title, "| date:", task.date, "| priority:", task.priority);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[api/task-chat] Missing ANTHROPIC_API_KEY");
      return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 401 });
    }

    // Load chat history for this specific task — isolated from tasks array
    const chatHistory = getTaskChat(taskId);
    console.log("[api/task-chat] Existing chat history length:", chatHistory.length);

    // Save user message to taskChats only — tasks array is NEVER touched
    addTaskChatMessage(taskId, "user", message.trim());
    console.log("[api/task-chat] Saved user message. tasks array unchanged.");

    const systemPrompt = `You are a personal AI assistant helping with a specific task.

Task details:
- Title: ${task.title}
- Date: ${task.date}
- Time: ${task.time}
- Priority: ${task.priority}
- Notes: ${task.notes ?? "none"}

Your job is to help the user plan, break down, think through, and execute this specific task.
Be specific, practical, and actionable.
Keep responses concise and under 100 words unless the user asks for more detail.
Do not modify any other tasks or the main schedule.
Focus only on helping with this specific task.
Do not output JSON. Respond only in plain conversational text.`;

    const conversationHistory = chatHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    console.log("[api/task-chat] Calling Anthropic with", conversationHistory.length + 1, "messages...");

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        temperature: 0.5,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user", content: message.trim() },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text();
      console.error("[api/task-chat] Anthropic error:", anthropicResponse.status, err);
      return NextResponse.json({ ok: false, error: `Anthropic error: ${anthropicResponse.status}` }, { status: 502 });
    }

    const anthropicData = (await anthropicResponse.json()) as {
      content?: { type: string; text: string }[];
    };
    console.log("[api/task-chat] Anthropic response:", JSON.stringify(anthropicData).slice(0, 200));

    if (!anthropicData.content || !anthropicData.content[0]) {
      console.error("[api/task-chat] Empty Anthropic response:", JSON.stringify(anthropicData));
      return NextResponse.json({ ok: false, error: "Empty Anthropic response" }, { status: 502 });
    }

    const aiMessage = anthropicData.content[0].text;
    console.log("[api/task-chat] Anthropic text:", aiMessage.slice(0, 100));

    // Save AI reply to taskChats only — tasks array is NEVER touched
    addTaskChatMessage(taskId, "assistant", aiMessage);
    console.log("[api/task-chat] Saved assistant reply. tasks array unchanged.");

    const updatedHistory = getTaskChat(taskId);

    return NextResponse.json({
      ok: true,
      reply: aiMessage,
      message: aiMessage,
      history: updatedHistory,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/task-chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
