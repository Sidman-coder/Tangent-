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
};

/** Rebuilds chronological turns from a session's [user, assistant, …] messages. */
export function turnsFromMessages(messages: { role: "user" | "assistant"; content: string }[]): Turn[] {
  const result: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    const next = messages[i + 1];
    const response = next && next.role === "assistant" ? next.content : "";
    result.push({
      id: crypto.randomUUID(),
      request: messages[i].content,
      tools: [],
      sourcesChecked: [],
      response,
    });
    if (next && next.role === "assistant") i++;
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
    default:
      return ["Assistant"];
  }
}
