// Shared by both ways proactive notifications get generated:
//  - app/api/proactive/route.ts       — called on page load from NotificationBell.tsx
//  - app/api/cron/proactive/route.ts  — called on a schedule (vercel.json), so overdue
//    and reschedule-offer notifications don't go stale for days if the student never
//    opens the app.
// Both stay on the synchronous Messages API (not Batch) — proactive suggestions are
// time-sensitive (an overdue-task nudge is only useful soon after it goes overdue),
// so they don't fit Batch's up-to-an-hour turnaround the way the daily brief does.

import { getAllTasks, getContextAsString, addNotification, getUserTimezone } from "@/lib/store";
import { isSchoolBlock } from "@/lib/schedule-slots";
import { isCanvasCleared } from "@/lib/canvas-clear";
import { formatTime12 } from "@/lib/dates";
import { addDaysYMD, currentInstant, getUserToday } from "@/lib/time";
import type { Notification } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { callClaude } from "@/lib/ai/call";

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

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "today (Tue, Oct 6)", "tomorrow (Wed, Oct 7)", "yesterday (…)" or
 *  "Thu, Oct 8", decided in code from the student's own today. */
export function relativeDayLabel(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const plain = `${SHORT_DAYS[day.getUTCDay()]}, ${SHORT_MONTHS[m - 1]} ${d}`;
  if (date === today) return `today (${plain})`;
  if (date === addDaysYMD(today, 1)) return `tomorrow (${plain})`;
  if (date === addDaysYMD(today, -1)) return `yesterday (${plain})`;
  return plain;
}

export async function runProactiveCheck(trigger: string): Promise<ProactiveCheckResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, generated: 0, notifications: [], error: "No API key" };

    // The School block is the student's timetable, not work they can fall
    // behind on: it produced "Overdue: School" nudges every day.
    const tasks = (await getAllTasks()).filter((t) => !isSchoolBlock(t));
    const userContext = await getContextAsString();
    const timeZone = await getUserTimezone();
    const now = currentInstant();
    const today = getUserToday(timeZone, now);
    const inThreeDays = addDaysYMD(getUserToday(timeZone, now), 3);
    const todayTasks = tasks.filter((t) => t.date === today);
    // Canvas work past CANVAS_CLEAR_DAYS counts as handled (the feed has no submissions).
    const overdueTasks = tasks.filter((t) => !t.completed && t.date < today && !isCanvasCleared(t, today));
    const upcomingTasks = tasks.filter(
      (t) =>
        !t.completed &&
        t.date > today &&
        t.date <= inThreeDays
    );

    // Relative days are worked out here, in the student's timezone, and given
    // to the model as labels. Left to itself it called Oct 8 "tomorrow" on Oct 6.
    const when = (date: string, time?: string) => {
      const label = relativeDayLabel(date, today);
      const clock = time && time !== "23:59" ? ` at ${formatTime12(time)}` : time === "23:59" ? " (due end of day)" : "";
      return `${label}${clock}`;
    };

    const agentContext = `
Today: ${relativeDayLabel(today, today)}
Current time: ${now.toLocaleTimeString("en-US", { timeZone })}

Today's tasks:
${todayTasks.map((t) => `- ${when(t.date, t.time)}: ${t.title} (${t.completed ? "done" : "pending"})`).join("\n") || "None"}

Overdue tasks:
${overdueTasks.map((t) => `- id=${t.id} was due ${when(t.date)}: ${t.title}`).join("\n") || "None"}

Upcoming (next 3 days):
${upcomingTasks.map((t) => `- ${when(t.date, t.time)}: ${t.title}`).join("\n") || "None"}

User context:
${userContext}
  `.trim();

    const response = await callClaude(
      "proactive",
      {
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

When you mention when something is, copy the day label exactly as given above ("tomorrow (Wed, Oct 7)", "Thu, Oct 8"). Never work out "today", "tomorrow" or a weekday yourself, and never write raw dates like 2026-10-08 or 24-hour times. Use 12-hour times like 3:30 PM.

Each notification's title should be short, under 8 words. Each body should be a specific actionable message under 30 words. actionLabel is an optional button label like 'Reschedule' or 'Add prep time'.

If nothing needs attention return an empty notifications array.`,
        messages: [{ role: "user", content: agentContext }],
      },
      { format: { type: "json_schema", schema: PROACTIVE_NOTIFICATIONS_SCHEMA } }
    );

    let suggestions: Array<{
      type: Notification["type"];
      title: string;
      body: string;
      actionLabel?: string;
      actionData?: Record<string, unknown>;
    }> = [];

    try {
      if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
      suggestions = extractStructuredJson<{ notifications: typeof suggestions }>(response.message).notifications;
    } catch (e) {
      console.error("[proactive] Notification parsing failed:", e instanceof Error ? e.message : e);
    }

    const added: Notification[] = [];
    for (const s of suggestions) {
      if (s.title && s.body) {
        const notif = await addNotification({
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
