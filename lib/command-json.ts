import type { Command } from "./types";

/**
 * Parses a JSON array of commands from model output or direct API body.
 */
export function parseCommandsFromText(text: string): Command[] | null {
  let trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) trimmed = fence[1].trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(Boolean) as Command[];
  } catch {
    return null;
  }
}

export const COMMAND_SYSTEM_PROMPT = `You are Tangent's command engine. The user message may be a voice transcript or instruction.
Respond with ONLY a JSON array of command objects (no markdown, no prose). Valid command shapes:
[
  {"type":"ADD_TASK","title":"string","dayOfWeek":0-6,"steps":["optional"],"calendarId":"optional"},
  {"type":"UPDATE_TASK","id":"task_id","title":"optional","dayOfWeek":0-6,"steps":["optional"]},
  {"type":"REMOVE_TASK","id":"task_id"},
  {"type":"ADD_CALENDAR","name":"string","category":"ALL|school|personal|work|other"},
  {"type":"ADD_EVENT","calendarId":"id","title":"string","date":"YYYY-MM-DD","steps":["optional"]},
  {"type":"UPDATE_USER","displayName":"optional","email":"optional"},
  {"type":"SET_WEEKLY_PLAN","items":["string", "..."]}
]
dayOfWeek: 0=Sunday … 6=Saturday.
If unsure about task ids, prefer ADD_TASK / ADD_EVENT. Use [] if nothing to do.`;
