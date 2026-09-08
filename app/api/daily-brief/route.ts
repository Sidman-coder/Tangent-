import { NextResponse } from "next/server";
import { getAllTasks, getContextAsString, addNotification } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "No API key" });

    const tasks = getAllTasks();
    const userContext = getContextAsString();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

    const todayTasks = tasks.filter((t) => t.date === today);
    const tomorrowTasks = tasks.filter((t) => t.date === tomorrow);
    const overdueTasks = tasks.filter((t) => !t.completed && t.date < today);
    const completedToday = todayTasks.filter((t) => t.completed);

    const briefContext = `
Date: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
Time: ${now.toLocaleTimeString()}

Today's tasks (${todayTasks.length} total, ${completedToday.length} done):
${todayTasks.map((t) => `- ${t.time} ${t.title} [${t.completed ? "✓" : "pending"}]`).join("\n") || "Nothing scheduled"}

Tomorrow:
${tomorrowTasks.map((t) => `- ${t.time} ${t.title}`).join("\n") || "Nothing scheduled yet"}

Overdue (${overdueTasks.length}):
${overdueTasks.slice(0, 5).map((t) => `- ${t.date} ${t.title}`).join("\n") || "None"}

About this user:
${userContext}
  `.trim();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        system: `Generate a concise daily brief for the user. Sound like a smart personal assistant, not a chatbot. Be specific to their actual schedule. No filler phrases. Direct and useful.

Format as JSON:
{
  "greeting": "one sentence greeting referencing something specific about their day",
  "summary": "2 to 3 sentences covering what matters most today",
  "topPriority": "the single most important thing to focus on",
  "suggestion": "one specific time-based suggestion based on their schedule and preferences",
  "overdueAlert": "mention overdue items only if there are any, otherwise null"
}

Return ONLY the JSON. No other text.`,
        messages: [{ role: "user", content: briefContext }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";

    let brief: {
      greeting: string;
      summary: string;
      topPriority: string;
      suggestion: string;
      overdueAlert: string | null;
    } = {
      greeting: "Good morning.",
      summary: "Here is your day.",
      topPriority: "Check your tasks.",
      suggestion: "Stay focused.",
      overdueAlert: null,
    };

    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      brief = JSON.parse(cleaned);
    } catch {}

    // Store as notification
    addNotification({
      type: "daily_brief",
      title: brief.greeting,
      body: `${brief.summary} Priority: ${brief.topPriority}`,
      actionLabel: "View full brief",
      actionData: { brief },
    });

    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/daily-brief] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
