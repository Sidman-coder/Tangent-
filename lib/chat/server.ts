// Server side of scoped chats: reads the task or project a thread is about
// and turns it into the budgeted note the pipeline reads (lib/chat/context.ts),
// and keeps each thread's running summary. Logs ids only, never chat content.

import { getAllPlans, getAllTasks, getChatSession, setChatSessionSummary } from "../store";
import { callClaude, messageText } from "../ai/call";
import { formatChatContext, type ChatContextStep } from "./context";
import { shouldSummarize, SUMMARY_EVERY, type ChatScope } from "./scope";

/** The note for a project thread, or null when the project is gone. */
export async function projectContext(projectId: string, summary?: string | null): Promise<string | null> {
  const [plans, tasks] = await Promise.all([getAllPlans(), getAllTasks()]);
  const plan = plans.find((p) => p.id === projectId);
  if (!plan) return null;
  const steps: ChatContextStep[] = tasks
    .filter((t) => t.planId === projectId)
    .map((t) => ({ title: t.title, date: t.date, done: t.completed }));
  return formatChatContext({ scope: "project", title: plan.title, goal: plan.description || null, steps, summary });
}

/** The note for a task thread, and the project it belongs to. */
export async function taskContext(
  taskId: string,
  summary?: string | null
): Promise<{ planId?: string; brief: string } | null> {
  const tasks = await getAllTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const when = [task.date, task.time].filter(Boolean).join(" at ") || null;
  const siblings: ChatContextStep[] = task.planId
    ? tasks.filter((t) => t.planId === task.planId && t.id !== task.id).map((t) => ({ title: t.title, date: t.date, done: t.completed }))
    : [];
  return {
    planId: task.planId ?? undefined,
    brief: formatChatContext({ scope: "task", title: task.title, when, notes: task.notes?.trim() || null, steps: siblings, summary }),
  };
}

/** The scoped note for any chat; "" when there's nothing to add. */
export async function buildChatContext(scope: ChatScope, summary?: string | null): Promise<string> {
  if (scope.type === "project") return (await projectContext(scope.projectId, summary)) ?? "";
  if (scope.type === "task") return (await taskContext(scope.taskId, summary))?.brief ?? "";
  return formatChatContext({ scope: "general", summary });
}

const SUMMARY_SYSTEM = `Summarize this chat between a student and their planning assistant in 2 to 4 short sentences, for the assistant to read later. Keep decisions, dates, preferences and open questions. Plain text, no lists, no greeting.`;

/** After an assistant message: refreshes the thread's summary every
 *  SUMMARY_EVERY messages. Best effort; a failure leaves the old summary. */
export async function summarizeIfDue(sessionId: string): Promise<boolean> {
  const session = await getChatSession(sessionId);
  if (!session) return false;
  const count = session.messages.length;
  const last = Math.floor((count - 1) / SUMMARY_EVERY) * SUMMARY_EVERY;
  if (!shouldSummarize(count, last)) return false;
  const transcript = session.messages
    .slice(-24)
    .map((m) => `${m.role === "user" ? "Student" : "Tangent"}: ${m.content.split("<!-- tangent:card")[0].trim().slice(0, 600)}`)
    .join("\n");
  const prior = session.summary ? `Earlier summary: ${session.summary}\n\n` : "";
  const result = await callClaude("chatSummary", {
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: `${prior}${transcript}` }],
  }).catch(() => null);
  const text = result?.ok ? messageText(result.message).trim() : "";
  if (!text) return false;
  return setChatSessionSummary(sessionId, text);
}
