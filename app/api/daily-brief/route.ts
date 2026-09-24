// Backs the on-demand "Today's Summary" button in the Bell panel (NotificationBell.tsx).
// This is deliberately NOT the "Daily Brief" feature — that name now belongs to the
// scheduled, source-aggregating pipeline in app/api/cron/daily-brief/route.ts. This
// route stays synchronous (Messages API, not Batch) because a student clicking the
// button wants an answer now, not in up to an hour. Both routes publish through the
// same publishDailyBrief() so the Bell only ever shows one pinned brief per day.
import { NextResponse } from "next/server";
import { getAllTasks, getContextAsString } from "@/lib/store";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { DAILY_BRIEF_SCHEMA, DEFAULT_DAILY_BRIEF, publishDailyBrief, type DailyBrief } from "@/lib/daily-brief";

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
        // Static system prompt in its own cached block — only per-user variable
        // data (briefContext) goes in the user message, so this block hits cache
        // on every subsequent brief generation.
        system: [
          {
            type: "text",
            text: `Generate a concise daily brief for the user. Sound like a smart personal assistant, not a chatbot. Be specific to their actual schedule. No filler phrases. Direct and useful.

The greeting is one sentence referencing something specific about their day. The summary is 2 to 3 sentences covering what matters most today. topPriority is the single most important thing to focus on. suggestion is one specific time-based suggestion based on their schedule and preferences. overdueAlert mentions overdue items only if there are any, otherwise null.`,
            cache_control: { type: "ephemeral" },
          },
        ],
        output_config: { format: { type: "json_schema", schema: DAILY_BRIEF_SCHEMA } },
        messages: [{ role: "user", content: briefContext }],
      }),
    });

    const data = await response.json();

    let brief: DailyBrief = DEFAULT_DAILY_BRIEF;

    try {
      brief = extractStructuredJson<DailyBrief>(data);
    } catch (e) {
      console.error("[api/daily-brief] Brief parsing failed:", e instanceof Error ? e.message : e);
    }

    publishDailyBrief(brief);

    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/daily-brief] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
