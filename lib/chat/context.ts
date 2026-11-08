// What a scoped chat tells the model about its task or project, kept inside a
// token budget so a big project never crowds out the conversation. Pure; the
// server side that reads the data is lib/chat/store.ts buildChatContext.

import type { ChatScopeType } from "./scope";

export const CHAT_CONTEXT_TOKEN_BUDGET = 1500;

/** Rough: about four characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type ChatContextStep = { title: string; date: string; done: boolean };

export type ChatContextData = {
  scope: ChatScopeType;
  title?: string;
  /** "Fri Nov 7 at 4:00 PM", or the project's last step date. */
  when?: string | null;
  goal?: string | null;
  notes?: string | null;
  /** Project steps, or the task's project siblings. */
  steps?: ChatContextStep[];
  /** The thread so far, summarized (chat_sessions.summary). */
  summary?: string | null;
};

function clip(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= maxChars ? t : `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** The note the pipeline reads, highest priority first, never over budget. */
export function formatChatContext(data: ChatContextData, budget: number = CHAT_CONTEXT_TOKEN_BUDGET): string {
  if (data.scope === "general" && !data.summary) return "";
  const maxChars = Math.max(0, budget * 4);
  const parts: string[] = [];
  let used = 0;
  const add = (text: string): boolean => {
    const cost = text.length + 1;
    if (used + cost > maxChars) return false;
    parts.push(text);
    used += cost;
    return true;
  };

  const title = data.title ? clip(data.title, 120) : "";
  if (data.scope === "task" && title) {
    add(`(The student is asking about this one task: "${title}", ${data.when || "no date yet"}. Help them plan, break down, think through or do it. Be concise, under 100 words unless they ask for more. Don't change other tasks unless they ask.)`);
  } else if (data.scope === "project" && title) {
    add(`(This request is inside the student's project "${title}". Anything you add belongs to this project.)`);
  }
  if (data.goal) add(`Goal: ${clip(data.goal, 300)}`);
  if (data.notes) add(`Notes: ${clip(data.notes, 600)}`);
  if (data.summary) add(`Earlier in this chat: ${clip(data.summary, 600)}`);

  const steps = data.steps ?? [];
  if (steps.length) {
    // Open steps first (soonest first), then what's done, until the budget runs out.
    const ordered = [...steps].sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
    if (add(data.scope === "task" ? "Other steps in its project:" : "Its steps so far:")) {
      let shown = 0;
      for (const s of ordered) {
        if (!add(`- ${s.done ? "[done] " : ""}${clip(s.title, 100)} (${s.date})`)) break;
        shown++;
      }
      if (shown < ordered.length) add(`- …and ${ordered.length - shown} more`);
    }
  } else if (data.scope === "project") {
    add("Its steps so far: none yet");
  }
  return parts.join("\n");
}
