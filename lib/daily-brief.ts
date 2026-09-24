// Shared by both ways a "Daily Brief" notification gets created:
//  - app/api/daily-brief/route.ts        — the on-demand "Today's Summary" button
//    (Bell panel), calls the Messages API directly since a student clicking a
//    button wants an immediate result.
//  - app/api/cron/daily-brief/route.ts   — the scheduled brief that aggregates the
//    student's saved brief-sources config, calls the Batch API since it's a
//    non-interactive overnight job.
// Both paths publish through publishDailyBrief so there's one notification-creation
// path, not two, and the Bell only ever shows one pinned "daily_brief" per day.

import {
  addNotification,
  getAllTasks,
  getBriefConfig,
  getContextAsString,
  getPendingBriefBatch,
  setPendingBriefBatch,
} from "@/lib/store";
import type { Notification } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { submitMessageBatch, getBatchStatus, fetchBatchResults } from "@/lib/anthropic-batch";
import { checkStaleItems, fetchRSSSummary, summarizeManualUrl, generateBriefNarration } from "@/lib/brief-sources";

export const DAILY_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    greeting: { type: "string" },
    summary: { type: "string" },
    topPriority: { type: "string" },
    suggestion: { type: "string" },
    overdueAlert: { type: ["string", "null"] },
  },
  required: ["greeting", "summary", "topPriority", "suggestion", "overdueAlert"],
  additionalProperties: false,
} as const;

export type DailyBrief = {
  greeting: string;
  summary: string;
  topPriority: string;
  suggestion: string;
  overdueAlert: string | null;
};

export const DEFAULT_DAILY_BRIEF: DailyBrief = {
  greeting: "Good morning.",
  summary: "Here is your day.",
  topPriority: "Check your tasks.",
  suggestion: "Stay focused.",
  overdueAlert: null,
};

export function publishDailyBrief(brief: DailyBrief): Notification {
  return addNotification({
    type: "daily_brief",
    title: brief.greeting,
    body: `${brief.summary} Priority: ${brief.topPriority}`,
    actionLabel: "View full brief",
    actionData: { brief },
  });
}

const DAILY_BRIEF_BATCH_CUSTOM_ID = "daily-brief";

const DAILY_BRIEF_SYSTEM_PROMPT = `Generate a concise daily brief for the user. Sound like a smart personal assistant, not a chatbot. Be specific to their actual schedule and to the external source material below, if any. No filler phrases. Direct and useful.

The greeting is one sentence referencing something specific about their day. The summary is 2 to 3 sentences covering what matters most today, weaving in relevant source material if any was provided. topPriority is the single most important thing to focus on. suggestion is one specific time-based suggestion based on their schedule and preferences. overdueAlert mentions overdue items only if there are any, otherwise null.`;

async function buildBriefContext(): Promise<string> {
  const tasks = getAllTasks();
  const userContext = getContextAsString();
  const config = getBriefConfig();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

  const todayTasks = tasks.filter((t) => t.date === today);
  const tomorrowTasks = tasks.filter((t) => t.date === tomorrow);
  const overdueTasks = tasks.filter((t) => !t.completed && t.date < today);
  const completedToday = todayTasks.filter((t) => t.completed);

  // Deterministic + cheap source gathering (zero or low AI cost) via the existing,
  // already-built lib/brief-sources.ts functions, keyed off the student's saved
  // BriefConfig (app/api/brief-config/route.ts, "Brief" tab in the AI console).
  const staleItems = checkStaleItems(tasks);
  const feedHeadlines: Record<string, string[]> = {};
  const manualSummaries: string[] = [];
  for (const source of config?.sources ?? []) {
    if (source.type === "rss" && source.url) {
      feedHeadlines[source.label] = await fetchRSSSummary(source.url);
    } else if (source.type === "manual_url" && source.url) {
      const summary = await summarizeManualUrl(source.url);
      if (summary) manualSummaries.push(`${source.label}: ${summary}`);
    }
    // "stale_check" sources need no per-source fetch — checkStaleItems(tasks) above
    // already covers staleness for all tasks regardless of how many stale_check
    // sources are configured.
  }
  const sourceNarration = await generateBriefNarration({ staleItems, feedHeadlines, manualSummaries });

  return `
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

External sources today:
${sourceNarration || "No sources configured, or nothing new since last check."}
  `.trim();
}

/**
 * Submits a Batch request for today's Daily Brief and records it as pending.
 * Does not wait for the result — Vercel Cron functions can't stay alive for the
 * batch's typical turnaround (minutes to a couple hours, up to 24h max). Call
 * pollPendingBriefBatch() on a later tick to finalize it into a notification.
 */
export async function submitDailyBriefBatch(): Promise<{ batchId: string }> {
  const briefContext = await buildBriefContext();
  const batchId = await submitMessageBatch([
    {
      custom_id: DAILY_BRIEF_BATCH_CUSTOM_ID,
      params: {
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        system: [{ type: "text", text: DAILY_BRIEF_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: { format: { type: "json_schema", schema: DAILY_BRIEF_SCHEMA } },
        messages: [{ role: "user", content: briefContext }],
      },
    },
  ]);
  setPendingBriefBatch({ batchId, submittedAt: new Date().toISOString() });
  return { batchId };
}

export type PollBriefBatchResult = {
  checked: boolean;
  finalized: boolean;
  notification?: Notification;
  error?: string;
};

/**
 * Checks whether a previously-submitted Daily Brief batch has finished, and if so,
 * publishes the same pinned "daily_brief" notification the on-demand button
 * produces (via publishDailyBrief) and clears the pending state. Cheap to call
 * often — it's a no-op when there's nothing pending. app/api/cron/proactive/route.ts
 * calls this on every tick (its cadence is more frequent than the brief's) so a
 * finished batch gets turned into a notification the same day it was submitted.
 */
export async function pollPendingBriefBatch(): Promise<PollBriefBatchResult> {
  const pending = getPendingBriefBatch();
  if (!pending) return { checked: false, finalized: false };

  let status;
  try {
    status = await getBatchStatus(pending.batchId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[daily-brief] pollPendingBriefBatch status check failed:", message);
    return { checked: true, finalized: false, error: message };
  }

  if (status.processing_status !== "ended") {
    return { checked: true, finalized: false };
  }

  setPendingBriefBatch(null);

  if (!status.results_url) {
    return { checked: true, finalized: false, error: "Batch ended without a results_url" };
  }

  const results = await fetchBatchResults(status.results_url);
  const mine = results.find((r) => r.custom_id === DAILY_BRIEF_BATCH_CUSTOM_ID);

  if (!mine || mine.result.type !== "succeeded") {
    const error = mine ? mine.result.type : "custom_id not found in batch results";
    console.error("[daily-brief] Batch did not succeed:", error);
    return { checked: true, finalized: false, error };
  }

  let brief: DailyBrief = DEFAULT_DAILY_BRIEF;
  try {
    brief = extractStructuredJson<DailyBrief>(mine.result.message);
  } catch (e) {
    console.error("[daily-brief] Brief parsing failed:", e instanceof Error ? e.message : e);
  }

  const notification = publishDailyBrief(brief);
  return { checked: true, finalized: true, notification };
}
