// "Export my data": every table a student owns, as JSON, built on the server.
// Secrets never leave: canvas_feeds.ics_url embeds a private Canvas token and
// pen_devices.device_key_hash identifies a pen.

export const EXPORT_TABLES: readonly string[] = [
  "profiles",
  "tasks",
  "plans",
  "plan_aliases",
  "calendars",
  "chat_sessions",
  "chat_messages",
  "task_chat_messages",
  "notifications",
  "action_records",
  "change_sets",
  "ai_decisions",
  "context_entries",
  "context_slots",
  "grill_questions",
  "brief_configs",
  "canvas_feeds",
  "paths",
  "path_nodes",
  "voice_logs",
  "pen_devices",
];

const SECRET_COLUMNS: Record<string, readonly string[]> = {
  canvas_feeds: ["ics_url"],
  pen_devices: ["device_key_hash"],
};

/** A copy of the row with secret columns dropped. */
export function redactExportRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const secrets = SECRET_COLUMNS[table];
  if (!secrets) return { ...row };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!secrets.includes(k)) out[k] = v;
  return out;
}
