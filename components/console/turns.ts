// Shared shape and helpers for AI console turns (one request + one reply).

export type Turn = {
  id: string;
  request: string;
  tools: string[];
  sourcesChecked: string[];
  response: string;
  actionId?: string;
  actionLabel?: string;
  pendingConfirm?: { id: string; message: string } | null;
  /** A schedule drafted in Plan mode — offers "Add to calendar". */
  planDraft?: boolean;
  /** Just arrived this session — its reply animates in word by word. */
  fresh?: boolean;
};

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

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
export type ChatMode = "plan" | "calendar";

/** Rebuilds chronological turns from a session's [user, assistant, …] messages.
 *  A confirm prompt followed by its outcome saves two assistant messages in a
 *  row; the later one wins, matching what the live console showed. A turn whose
 *  reply is still an open confirmation's prompt gets its Confirm/Cancel back. */
export function turnsFromMessages(
  messages: { role: "user" | "assistant"; content: string }[],
  openConfirms: { id: string; message: string }[] = []
): Turn[] {
  const result: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    const request = messages[i].content;
    let response = "";
    while (messages[i + 1]?.role === "assistant") response = messages[++i].content;
    result.push({ id: crypto.randomUUID(), request, tools: [], sourcesChecked: [], response });
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
