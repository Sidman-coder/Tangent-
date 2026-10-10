// Pipeline V2 (TANGENT_PIPELINE_V2 on only): client calls shared by the AI
// console and the command palette. Kept here so those components change by a
// few lines each.

import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import type { Turn } from "@/components/console/turns";

export type Draft = { changeSet: ChangeSet; preview: PreviewPayload };

/** "Add plan to calendar": drafts exactly the reply the student saw. */
export async function draftShownPlan(text: string, request: string): Promise<Draft | { error: string }> {
  try {
    const res = await fetch("/api/changesets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, request }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string; response?: string; changeSet?: ChangeSet; preview?: PreviewPayload };
    if (res.ok && data.ok && data.changeSet && data.preview) return { changeSet: data.changeSet, preview: data.preview };
    return { error: data.message || data.response || "Couldn't prepare that plan. Nothing was added." };
  } catch {
    return { error: "Couldn't reach the server. Nothing was added." };
  }
}

/** "Just talking, don't add": a conversational reply; nothing is drafted. */
export async function chatOnly(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, route: "chat" }),
    });
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
    if (res.ok && data.ok && data.message) return data.message;
    return data.error || "Okay, nothing was added.";
  } catch {
    return "Okay, nothing was added.";
  }
}

/** This student's open drafts from the last 24 hours, newest first. */
export async function fetchOpenDrafts(): Promise<Draft[]> {
  try {
    const res = await fetch("/api/changesets");
    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; drafts?: Draft[] };
    return data.ok ? data.drafts ?? [] : [];
  } catch {
    return [];
  }
}

const WAITING = "Still waiting for you to confirm this.";

/** Puts open drafts back on the thread: on the turn that asked for each one
 *  when it's there, otherwise as a turn of its own (oldest first). */
export function withOpenDrafts(turns: Turn[], drafts: Draft[]): Turn[] {
  const shown = new Set(turns.flatMap((t) => (t.draft ? [t.draft.changeSet.id] : [])));
  const next = turns.slice();
  for (const d of [...drafts].reverse()) {
    if (shown.has(d.changeSet.id)) continue;
    let at = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      if (!next[i].draft && next[i].request === d.changeSet.request_text) {
        at = i;
        break;
      }
    }
    if (at >= 0) next[at] = { ...next[at], draft: d, planDraft: false };
    else next.push({ id: d.changeSet.id, request: d.changeSet.request_text, tools: [], sourcesChecked: [], response: WAITING, draft: d });
  }
  return next;
}
