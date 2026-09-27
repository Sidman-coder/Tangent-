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
