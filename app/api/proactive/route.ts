import { NextResponse } from "next/server";
import { getAllTasks, getContextAsString, addNotification } from "@/lib/store";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

// This route is called periodically to check for proactive suggestions
// In production this would be triggered by a cron job (Vercel cron)
// For now it can be called manually or on page load

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trigger = body.trigger || "manual"; // 'manual', 'page_load', 'cron'

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false });

    const tasks = getAllTasks();
    const userContext = getContextAsString();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const todayTasks = tasks.filter((t) => t.date === today);
    const overdueTasks = tasks.filter((t) => !t.completed && t.date < today);
    const upcomingTasks = tasks.filter(
      (t) =>
        !t.completed &&
        t.date > today &&
        t.date <= new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0]
    );

    // Build context for proactive agent
    const agentContext = `
Today: ${today}
Current time: ${now.toLocaleTimeString()}

Today's tasks:
${todayTasks.map((t) => `- ${t.time} ${t.title} (${t.completed ? "done" : "pending"})`).join("\n") || "None"}

Overdue tasks:
${overdueTasks.map((t) => `- id=${t.id} ${t.date} ${t.title}`).join("\n") || "None"}

Upcoming (next 3 days):
${upcomingTasks.map((t) => `- ${t.date} ${t.time} ${t.title}`).join("\n") || "None"}

User context:
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
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: `You are a proactive productivity assistant. Analyze the user's schedule and context, then generate 0 to 3 actionable notifications only if something genuinely needs attention.

Do not generate notifications for:
- Tasks already completed
- Things the user is already on track for
- Generic motivational messages with no specific action

Only generate notifications for:
- Overdue tasks that need rescheduling
- Upcoming deadlines with no prep scheduled
- Schedule gaps where productive work could happen
- Conflicts or time crunches
- Specific suggestions based on user preferences

Also check the overdue tasks list above. For each overdue task, if there is a free slot
later today or tomorrow, generate a notification of type "reschedule_offer" with
actionLabel "Move it" and actionData containing exactly:
{ "taskId": "<the task's id>", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM" }
Only offer one reschedule_offer per overdue task, and only when you can name a specific
free slot — do not offer it if you cannot suggest a concrete date and time.

Return ONLY a JSON array. No other text:
[{
  "type": "overdue_task" | "upcoming_deadline" | "proactive_suggestion" | "reschedule_offer",
  "title": "short title under 8 words",
  "body": "specific actionable message under 30 words",
  "actionLabel": "optional button label like 'Reschedule' or 'Add prep time'",
  "actionData": {}
}]

If nothing needs attention return: []`,
        messages: [{ role: "user", content: agentContext }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    let suggestions: Array<{
      type: Notification["type"];
      title: string;
      body: string;
      actionLabel?: string;
      actionData?: Record<string, unknown>;
    }> = [];

    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = [];
    }

    const added: Notification[] = [];
    for (const s of suggestions) {
      if (s.title && s.body) {
        const notif = addNotification({
          type: s.type,
          title: s.title,
          body: s.body,
          actionLabel: s.actionLabel,
          actionData: s.actionData,
        });
        added.push(notif);
      }
    }

    console.log(`[proactive] Trigger: ${trigger} | Generated: ${added.length} notifications`);

    return NextResponse.json({
      ok: true,
      generated: added.length,
      notifications: added,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/proactive] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
