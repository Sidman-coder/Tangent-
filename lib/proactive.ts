// Shared by both ways proactive notifications get generated:
//  - app/api/proactive/route.ts       — called from NotificationBell.tsx on Home and Calendar
//  - app/api/cron/proactive/route.ts  — called on a schedule (vercel.json), so overdue
//    and reschedule-offer notifications don't go stale for days if the student never
//    opens the app.
//
// Overnight 2, Phase 4: cheaper. The check runs at most once per 4 hours per
// student (profiles.notification_prefs.proactiveAt, no schema change). What
// qualifies is decided in plain code (lib/proactive-rules.ts): overdue, due
// within 48 hours, a goal step that slipped. Overdue and due-soon come from
// templates. Only the reschedule asks Haiku, which picks one of the slots code
// found and says why in one line. Nothing qualifies: no model call.
// Synchronous Messages API (not Batch): a reschedule offer is only useful soon.

import { getAllTasks, addNotification, getUserTimezone, getNotificationPrefs, markProactiveRun } from "@/lib/store";
import { studentFactsText } from "@/lib/ai/student-context";
import { firstOpenTime, isBusyBlock } from "@/lib/schedule-slots";
import { formatTime12 } from "@/lib/dates";
import { addDaysYMD, currentInstant, localNow } from "@/lib/time";
import type { Notification, Task } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { callClaude } from "@/lib/ai/call";
import {
  dueSoonNotices,
  hasFindings,
  overdueNotice,
  proactiveDue,
  proactiveFindings,
  rescheduleNotice,
  rescheduleWindow,
  type Notice,
  type Slot,
} from "@/lib/proactive-rules";

const RESCHEDULE_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          slot: { type: "string" },
          why: { type: "string" },
        },
        required: ["taskId", "slot", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["offers"],
  additionalProperties: false,
} as const;

export type ProactiveCheckResult = {
  ok: boolean;
  generated: number;
  notifications: Notification[];
  /** Why nothing ran: inside the 4-hour gap, or nothing qualified. */
  skipped?: "throttled" | "nothing";
  /** Model calls this run made (0 or 1). */
  aiCalls?: number;
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

/** "today", "tomorrow", "yesterday" or "Thu, Oct 8": for notification text. */
function dayWord(date: string, today: string): string {
  const label = relativeDayLabel(date, today);
  return label.replace(/ \(.*\)$/, "");
}

/** Up to three open slots for a slipped step: later today, then the next two days. */
function openSlots(tasks: Task[], now: { date: string; minutes: number }): Slot[] {
  const slots: Slot[] = [];
  for (const date of rescheduleWindow(now.date)) {
    const time = firstOpenTime(tasks, date, date === now.date ? now.minutes + 30 : 0);
    if (time) slots.push({ date, time });
  }
  return slots;
}

/** Haiku picks a slot per slipped step and says why in one line. Null on any failure. */
async function smartReschedule(
  steps: Task[],
  slots: Slot[],
  today: string
): Promise<Map<string, { slot: Slot; why: string }> | null> {
  const letters = slots.map((_, i) => String.fromCharCode(65 + i));
  const facts = (await studentFactsText("brief").catch(() => "")).slice(0, 600);
  const content = [
    `Today: ${relativeDayLabel(today, today)}`,
    `Open slots: ${slots.map((s, i) => `${letters[i]} = ${relativeDayLabel(s.date, today)} at ${formatTime12(s.time)}`).join("; ")}`,
    `Steps that slipped:`,
    ...steps.map((t) => `- id=${t.id}: "${t.title}", was for ${relativeDayLabel(t.date, today)}${t.time && t.time !== "23:59" ? ` at ${formatTime12(t.time)}` : ""}`),
    facts ? `About the student:\n${facts}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const response = await callClaude(
    "proactive",
    {
      system: `Pick one open slot (by letter) for each step that slipped. Prefer the slot that fits what you know about the student (energy, practice times, how long steps take); otherwise the earliest. Two steps may share a slot only if nothing better is open.
"why" is one sentence under 20 words that names a concrete fact: the slot's day and time, and what makes it fit. Copy day labels exactly as given ("tomorrow", "Thu, Oct 8"). 12-hour times. No guilt, no "you missed", no exclamation marks.`,
      messages: [{ role: "user", content }],
    },
    { format: { type: "json_schema", schema: RESCHEDULE_SCHEMA } }
  );
  if (!response.ok) return null;
  try {
    const { offers } = extractStructuredJson<{ offers: { taskId: string; slot: string; why: string }[] }>(response.message);
    const picked = new Map<string, { slot: Slot; why: string }>();
    for (const o of offers ?? []) {
      const i = letters.indexOf(o.slot.trim().toUpperCase().slice(0, 1));
      if (i < 0 || !steps.some((t) => t.id === o.taskId)) continue;
      // A "why" that writes a raw date or a 24-hour time is dropped for the template's.
      const why = /\d{4}-\d{2}-\d{2}|\b(?:1[3-9]|2[0-3]):\d{2}\b/.test(o.why) ? "" : o.why.trim().slice(0, 160);
      picked.set(o.taskId, { slot: slots[i], why });
    }
    return picked;
  } catch {
    return null;
  }
}

export async function runProactiveCheck(trigger: string): Promise<ProactiveCheckResult> {
  try {
    const at = currentInstant();
    // At most once per 4 hours per student, from any trigger.
    if (!proactiveDue((await getNotificationPrefs()).proactiveAt, at)) {
      console.log(`[proactive] Trigger: ${trigger} | skipped: within 4h`);
      return { ok: true, generated: 0, notifications: [], skipped: "throttled", aiCalls: 0 };
    }
    await markProactiveRun(at);

    const timeZone = await getUserTimezone();
    const now = localNow(timeZone, at);
    const tasks = await getAllTasks();
    // The School block is the student's timetable, not work they can fall behind on.
    const found = proactiveFindings(tasks, now, isBusyBlock);
    if (!hasFindings(found)) {
      console.log(`[proactive] Trigger: ${trigger} | nothing qualifies, no AI`);
      return { ok: true, generated: 0, notifications: [], skipped: "nothing", aiCalls: 0 };
    }

    const day = (date: string) => dayWord(date, now.date);
    const notices: Notice[] = [];
    const overdue = overdueNotice(found.overdue, day);
    if (overdue) notices.push(overdue);
    notices.push(...dueSoonNotices(found.dueSoon, tasks, now, day, formatTime12));

    let aiCalls = 0;
    if (found.reschedule.length > 0) {
      const slots = openSlots(tasks, now);
      if (slots.length > 0) {
        aiCalls = process.env.ANTHROPIC_API_KEY ? 1 : 0;
        const picks = aiCalls ? await smartReschedule(found.reschedule, slots, now.date).catch(() => null) : null;
        for (const t of found.reschedule) {
          const pick = picks?.get(t.id);
          notices.push(rescheduleNotice(t, pick?.slot ?? slots[0], day, formatTime12, pick?.why));
        }
      }
    }

    const added: Notification[] = [];
    for (const n of notices) added.push(await addNotification(n));
    console.log(`[proactive] Trigger: ${trigger} | Generated: ${added.length} notifications | AI calls: ${aiCalls}`);
    return { ok: true, generated: added.length, notifications: added, aiCalls };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[proactive] Error:", message);
    return { ok: false, generated: 0, notifications: [], error: message };
  }
}
