import type { AppState, Command, DayOfWeek } from "./types";

export type GroqVoicePayload = {
  action: "add_task" | "complete_task" | "delete_task";
  title: string;
  date: string;
  time: string;
  priority: "high" | "medium" | "low";
  response: string;
};

function parseYmdToDayOfWeek(ymd: string): DayOfWeek {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date().getDay() as DayOfWeek;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.getDay() as DayOfWeek;
}

function findTaskByTitleLoose(tasks: AppState["tasks"], needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) return undefined;
  const exact = tasks.find((t) => t.title.toLowerCase() === n);
  if (exact) return exact;
  return tasks.find(
    (t) => t.title.toLowerCase().includes(n) || n.includes(t.title.toLowerCase())
  );
}

/** Normalize Groq JSON (already parsed) into a strict payload, or null if invalid. */
export function normalizeVoiceCommand(parsed: unknown): GroqVoicePayload | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const action = obj.action;
  if (action !== "add_task" && action !== "complete_task" && action !== "delete_task") {
    return null;
  }
  const today = new Date().toISOString().slice(0, 10);
  const pri = obj.priority;
  const priority: "high" | "medium" | "low" =
    pri === "high" || pri === "low" || pri === "medium" ? pri : "medium";
  return {
    action,
    title: typeof obj.title === "string" ? obj.title : "",
    date: typeof obj.date === "string" && obj.date.trim() ? obj.date.trim() : today,
    time: typeof obj.time === "string" && obj.time.trim() ? obj.time.trim() : "09:00",
    priority,
    response: typeof obj.response === "string" ? obj.response : "",
  };
}

export function parseGroqVoiceJson(text: string): GroqVoicePayload | null {
  let raw = text.trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) raw = fence[1].trim();
  try {
    return normalizeVoiceCommand(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function groqVoicePayloadToCommands(payload: GroqVoicePayload, state: AppState): Command[] {
  const title = payload.title.trim();
  if (!title) return [];

  const date = payload.date?.trim() || new Date().toISOString().slice(0, 10);
  const time = payload.time?.trim() || "09:00";
  const pri = payload.priority || "medium";

  switch (payload.action) {
    case "add_task": {
      const dayOfWeek = parseYmdToDayOfWeek(date);
      const displayTitle = time && time !== "09:00" ? `${title} (${time})` : title;
      return [
        {
          type: "ADD_TASK",
          title: displayTitle,
          dayOfWeek,
          steps: [`Priority: ${pri}`],
        },
      ];
    }
    case "complete_task": {
      const t = findTaskByTitleLoose(state.tasks, title);
      if (!t) return [];
      return [{ type: "UPDATE_TASK", id: t.id, steps: ["✓ Completed"] }];
    }
    case "delete_task": {
      const t = findTaskByTitleLoose(state.tasks, title);
      if (!t) return [];
      return [{ type: "REMOVE_TASK", id: t.id }];
    }
    default:
      return [];
  }
}
