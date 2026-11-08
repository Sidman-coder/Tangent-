// Shared shape and helpers for AI console turns (one request + one reply).

import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import type { UndoStatus } from "@/lib/undo-events";
import type { PendingQuestion } from "@/lib/pending-question";
import type { ClarifyQuestion } from "./ClarifyCard";

export type Turn = {
  id: string;
  request: string;
  tools: string[];
  sourcesChecked: string[];
  response: string;
  actionId?: string;
  actionLabel?: string;
  /** Set on a reopened chat after re-checking actionId (lib/undo-events.ts). */
  undoStatus?: UndoStatus;
  /** Pipeline V2: the change set this turn previewed (saved with the reply). */
  changeSetId?: string;
  pendingConfirm?: { id: string; message: string } | null;
  /** A schedule drafted in Plan mode — offers "Add to calendar". */
  planDraft?: boolean;
  /** Pipeline V2 (A4): talked through after "Just talking" (components/console/talking.ts). */
  talking?: boolean;
  /** Pipeline V2 (A4): the reply is a complete schedule; the chip offers it. */
  planReady?: boolean;
  /** Pipeline V2 (A4): that schedule was drafted into a preview or dismissed. */
  planClosed?: boolean;
  /** Just arrived this session — its reply animates in word by word. */
  fresh?: boolean;
  /** Pipeline V2: a drafted change waiting for Confirm (components/PreviewCard). */
  draft?: { changeSet: ChangeSet; preview: PreviewPayload };
  /** Tangent's questions before acting (lib/ai/clarify.ts); cleared once answered. */
  questions?: ClarifyQuestion[] | null;
  /** A question Tangent is waiting on ("Which one should I delete?"): sent
   *  back with the next message until it expires (lib/pending-question.ts). */
  pendingQuestion?: PendingQuestion | null;
  /** Questions about a task this turn already saved; answering is optional. */
  later?: { id: string; questions: { id: string; question: string; options: string[] }[] } | null;
  /** What Tangent changed after those answers. */
  laterSummary?: string | null;
  /** A plan this turn created: it lives on as a Project. */
  projectId?: string | null;
  /** One move the spacing brain suggests for an overloaded day. */
  suggestion?: { taskId: string; title: string; toDate: string; toTime: string; message: string } | null;
  /** Master fix Phase 4: its preview card was confirmed this session. */
  applied?: boolean;
  /** The reply streamed in as it was written (no word-by-word reveal after). */
  streamed?: boolean;
  /** Thumbs on this reply (logged as chat_feedback). */
  feedback?: "up" | "down";
  /** The student pressed Stop: the reply is what had arrived. */
  stopped?: boolean;
};

/** Master fix Phase 4: Retry / Edit may replace this turn. Never one that
 *  changed (or may change) the calendar: it keeps its own Undo instead. */
export function redoable(t: Turn): boolean {
  return !t.actionId && !t.applied && !t.changeSetId && !t.pendingConfirm && !t.projectId && !t.draft && !t.later;
}

/** A plan being generated: its title as soon as the outline is back, then
 *  each session as it's written (slots fill in any order). Not saved yet. */
export type PlanProgressView = {
  title: string;
  taskCount: number;
  tasks: ({ title: string; date: string; time: string } | null)[];
};

/** Applies one streamed /api/chat progress line to the live plan view. */
export function applyPlanProgress(view: PlanProgressView | null, line: Record<string, unknown>): PlanProgressView | null {
  if (line.type === "plan_outline" && typeof line.title === "string" && typeof line.taskCount === "number") {
    const tasks = Array.from({ length: line.taskCount }, (_, i) => view?.tasks[i] ?? null);
    return { title: line.title, taskCount: line.taskCount, tasks };
  }
  if (line.type === "plan_task" && typeof line.index === "number" && line.task && typeof line.task === "object") {
    const base = view ?? { title: "", taskCount: 0, tasks: [] };
    const tasks = base.tasks.slice();
    tasks[line.index] = line.task as { title: string; date: string; time: string };
    return { ...base, tasks };
  }
  return view;
}

/** Master fix B3: a question card saved with its message, so a reopened chat
 *  shows the card again instead of bullet text. A hidden HTML comment at the
 *  end (URI-encoded, so it can't close early); the text before it is what the
 *  thread and the model see. */
export type SavedCard = { questions: ClarifyQuestion[]; pendingQuestion?: PendingQuestion | null };

const CARD_RE = /\n*<!-- tangent:card (\S*) -->\s*$/;

export function withCard(text: string, card: SavedCard): string {
  return `${text}\n\n<!-- tangent:card ${encodeURIComponent(JSON.stringify(card))} -->`;
}

/** The message's text and its saved card, if any (a bad marker is dropped). */
export function splitCard(content: string): { text: string; card: SavedCard | null } {
  const m = CARD_RE.exec(content);
  if (!m) return { text: content, card: null };
  const text = content.slice(0, m.index);
  try {
    const card = JSON.parse(decodeURIComponent(m[1])) as SavedCard;
    const ok =
      Array.isArray(card?.questions) &&
      card.questions.every((q) => q && typeof q.id === "string" && typeof q.question === "string" && Array.isArray(q.options));
    return { text, card: ok ? card : null };
  } catch {
    return { text, card: null };
  }
}

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
export type ChatMode = "plan" | "calendar";

/** Rebuilds chronological turns from a session's [user, assistant, …] messages.
 *  A confirm prompt followed by its outcome saves two assistant messages in a
 *  row; the later one wins, matching what the live console showed. A turn whose
 *  reply is still an open confirmation's prompt gets its Confirm/Cancel back.
 *  The last turn's saved question card comes back live (its pending question
 *  only until it expires); older cards were answered, so only their text shows. */
export function turnsFromMessages(
  messages: { role: "user" | "assistant"; content: string; actionId?: string; changeSetId?: string }[],
  openConfirms: { id: string; message: string }[] = [],
  now: Date = new Date()
): Turn[] {
  const result: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    const request = messages[i].content;
    let response = "";
    // The saved change ids come back with the reply, so Undo survives a reload.
    let actionId: string | undefined;
    let changeSetId: string | undefined;
    let card: SavedCard | null = null;
    while (messages[i + 1]?.role === "assistant") {
      const m = messages[++i];
      ({ text: response, card } = splitCard(m.content));
      actionId = m.actionId ?? actionId;
      changeSetId = m.changeSetId ?? changeSetId;
    }
    result.push({
      id: crypto.randomUUID(),
      request,
      tools: [],
      sourcesChecked: [],
      response,
      ...(actionId ? { actionId } : {}),
      ...(changeSetId ? { changeSetId } : {}),
      ...(card && i === messages.length - 1 ? liveCard(card, now) : {}),
    });
  }
  // Newest turns claim the newest matching confirmation; each is used once.
  const unclaimed = [...openConfirms];
  for (let t = result.length - 1; t >= 0 && unclaimed.length > 0; t--) {
    const k = unclaimed.findIndex((c) => c.message === result[t].response);
    if (k === -1) continue;
    result[t].pendingConfirm = unclaimed[k];
    unclaimed.splice(k, 1);
  }
  return result;
}

function liveCard(card: SavedCard, now: Date): Pick<Turn, "questions" | "pendingQuestion"> {
  const pending = card.pendingQuestion;
  if (!pending) return { questions: card.questions };
  // An expired "Which one?" can't be answered any more: show the text only.
  if (!(Date.parse(pending.expiresAt) > now.getTime())) return {};
  return { questions: card.questions, pendingQuestion: pending };
}

export function cleanMessage(text: string): string {
  if (!text) return "Done! Your request has been processed.";
  let cleaned = text.replace(/```json[\s\S]*?```/gi, "").trim();
  cleaned = cleaned.replace(/```[\s\S]*?```/gi, "").trim();
  if (cleaned.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      if (typeof parsed.response === "string") return parsed.response;
      if (typeof parsed.reply === "string") return parsed.reply;
      if (typeof parsed.message === "string") return parsed.message;
      if (typeof parsed.planTitle === "string") return `Your ${parsed.planTitle} has been created!`;
    } catch {}
    return "Done! Your request has been processed.";
  }
  if (cleaned.includes('"action"') || cleaned.includes('"tasks"')) {
    return "Done! Your request has been processed.";
  }
  return cleaned || "Done! Your request has been processed.";
}

export function actionLabel(action: string | null | undefined, extra?: Record<string, unknown>): string | null {
  if (!action) return null;
  if (action === "add_task") return "Task added to calendar";
  if (action === "complete_task") return "Task marked as complete";
  if (action === "delete_task") return "Task deleted";
  if (action === "add_recurring_task") {
    const count = typeof extra?.taskCount === "number" ? extra.taskCount : 0;
    return `Recurring task — ${count} instance${count !== 1 ? "s" : ""} added`;
  }
  if (action === "plan" || action === "create_plan") {
    const count = typeof extra?.taskCount === "number" ? extra.taskCount : 0;
    const title = typeof extra?.planTitle === "string" ? extra.planTitle : "Plan";
    return `${title} — ${count} task${count !== 1 ? "s" : ""} created`;
  }
  return null;
}

export function toolsForAction(action: string | null | undefined): string[] {
  switch (action) {
    case "add_task":
    case "complete_task":
    case "delete_task":
      return ["Tasks"];
    case "add_recurring_task":
      return ["Tasks", "Recurring"];
    case "plan":
    case "create_plan":
      return ["Planner", "Tasks"];
    case "confirm_required":
      return ["Confirmation"];
    case "preview":
      return ["Preview"];
    case "plan_reply":
      return ["Plan mode"];
    case "error":
      return ["Not added"];
    default:
      return ["Assistant"];
  }
}

/** Reads an /api/chat reply. A streamed (NDJSON) reply passes each progress
 *  line to onLine and resolves with its final {type:"result"} line; a plain
 *  JSON reply (Plan mode, errors before the stream starts) resolves as is. */
export async function readChatReply(res: Response, onLine: (line: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
  if (!(res.headers.get("content-type") ?? "").includes("ndjson") || !res.body) {
    return (await res.json()) as Record<string, unknown>;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Record<string, unknown> | null = null;
  const handle = (raw: string) => {
    if (!raw.trim()) return;
    let line: Record<string, unknown>;
    try {
      line = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (line.type === "result") {
      const { type: _type, ...rest } = line;
      result = rest;
    } else {
      onLine(line);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      handle(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  handle(buffer + decoder.decode());
  if (!result) throw new Error("The reply was cut off. Check your calendar before trying again.");
  return result;
}
