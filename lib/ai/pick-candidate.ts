// Master fix B5: the FAST model's read of a reply the word matching couldn't
// place ("the one with the essays"), choosing among the question's own
// options or none. It sees numbers, not ids, so it can't invent one: anything
// outside the list is dropped. Used once per question, before showing the
// buttons again (lib/voice-handler.ts, lib/pipeline/understand.ts).

import "server-only";
import { callClaude } from "./call";
import { extractStructuredJson } from "../anthropic-json";

export type PickOption = { id: string; title: string; hint?: string };

const SCHEMA = {
  type: "object",
  properties: { picks: { type: "array", items: { type: "integer" } } },
  required: ["picks"],
  additionalProperties: false,
} as const;

const SYSTEM = `A student was asked a question with numbered options and replied in their own words.
Return the numbers of the options their reply means. Several only when the reply clearly names several.
If the reply fits none of them, or you are not sure, return an empty list. Spelling mistakes and nicknames are fine; guesses are not.`;

/** The option ids the reply means, [] for none, or null when the call failed. */
export async function pickCandidates(question: string, reply: string, options: readonly PickOption[]): Promise<string[] | null> {
  if (options.length === 0 || !reply.trim()) return [];
  const list = options
    .slice(0, 8)
    .map((o, i) => `${i + 1}. ${o.title}${o.hint ? ` (has: ${o.hint})` : ""}`)
    .join("\n");
  const result = await callClaude(
    "pickCandidate",
    {
      system: SYSTEM,
      messages: [{ role: "user", content: `Question: ${question.slice(0, 300)}\nOptions:\n${list}\nReply: ${reply.slice(0, 300)}` }],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) {
    console.warn("[pick-candidate] call failed:", result.status);
    return null;
  }
  try {
    const { picks } = extractStructuredJson<{ picks: unknown }>(result.message);
    if (!Array.isArray(picks)) return [];
    const ids = picks
      .filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= Math.min(options.length, 8))
      .map((n) => options[n - 1].id);
    return Array.from(new Set(ids));
  } catch {
    return null;
  }
}
