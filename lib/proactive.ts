// Shared by both ways proactive notifications get generated:
//  - app/api/proactive/route.ts       — called on page load from NotificationBell.tsx
//  - app/api/cron/proactive/route.ts  — called on a schedule (vercel.json), so overdue
//    and reschedule-offer notifications don't go stale for days if the student never
//    opens the app.
// Both stay on the synchronous Messages API (not Batch) — proactive suggestions are
// time-sensitive (an overdue-task nudge is only useful soon after it goes overdue),
// so they don't fit Batch's up-to-an-hour turnaround the way the daily brief does.

import { getAllTasks, getContextAsString, addNotification } from "@/lib/store";
import type { Notification } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";

const PROACTIVE_NOTIFICATIONS_SCHEMA = {
  type: "object",
  properties: {
    notifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["overdue_task", "upcoming_deadline", "proactive_suggestion", "reschedule_offer"],
          },
          title: { type: "string" },
          body: { type: "string" },
          actionLabel: { type: "string" },
          actionData: {
            type: "object",
            properties: {
              taskId: { type: "string" },
              suggestedDate: { type: "string" },
              suggestedTime: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        required: ["type", "title", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["notifications"],
  additionalProperties: false,
} as const;

export type ProactiveCheckResult = {
  ok: boolean;
  generated: number;
  notifications: Notification[];
  error?: string;
};

export async function runProactiveCheck(trigger: string): Promise<ProactiveCheckResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, generated: 0, notifications: [], error: "No API key" };

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

Each notification's title should be short, under 8 words. Each body should be a specific actionable message under 30 words. actionLabel is an optional button label like 'Reschedule' or 'Add prep time'.

If nothing needs attention return an empty notifications array.`,
        output_config: { format: { type: "json_schema", schema: PROACTIVE_NOTIFICATIONS_SCHEMA } },
        messages: [{ role: "user", content: agentContext }],
      }),
    });

    const data = await response.json();

    let suggestions: Array<{
      type: Notification["type"];
      title: string;
      body: string;
      actionLabel?: string;
      actionData?: Record<string, unknown>;
    }> = [];

    try {
      suggestions = extractStructuredJson<{ notifications: typeof suggestions }>(data).notifications;
    } catch (e) {
      console.error("[proactive] Notification parsing failed:", e instanceof Error ? e.message : e);
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

    return { ok: true, generated: added.length, notifications: added };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[proactive] Error:", message);
    return { ok: false, generated: 0, notifications: [], error: message };
  }
}
