import "server-only";
import { addContextEntry } from "@/lib/store";
import type { ContextEntry } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { callClaude } from "@/lib/ai/call";

const CONTEXT_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["preference", "habit", "commitment", "goal", "person", "work", "general"],
          },
          fact: { type: "string" },
          stated: { type: "boolean" },
        },
        required: ["category", "fact", "stated"],
        additionalProperties: false,
      },
    },
  },
  required: ["facts"],
  additionalProperties: false,
} as const;

const SYSTEM = `Extract durable facts about a high school student from this conversation: things that will still be true in a few weeks. Ignore one-time events and tasks already handled.

Write each fact to the student, in the second person, as one short sentence: "You have soccer practice Mondays and Wednesdays until 6", "You do your best work late at night". Be specific; leave out anything too vague to plan with ("you have a test coming up").

stated: true when the student said it outright, false when you are inferring it.

Never extract health, mental health, family conflict, relationships, sexuality, religion, substances or anything else sensitive, even if the student mentions it.

Categories: preference (how they like to work), habit (what they regularly do), commitment (recurring schedule), goal (what they are working toward), person (someone they mention), work (classes, clubs, jobs, projects), general (other durable facts).

If nothing durable is found return an empty facts array.`;

/** Pulls durable facts about the student out of one exchange and adds them to
 *  what Tangent knows. Facts go through the same filter as every other write
 *  (lib/student/facts.ts prepareFact): sensitive or vague ones are never kept.
 *  Nothing is compressed away: the context pack ranks facts instead. Runs
 *  inside the caller's user context. */
export async function extractContextFacts(conversation: string, source: ContextEntry["source"] = "chat"): Promise<ContextEntry[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !conversation.trim()) return [];

  const response = await callClaude(
    "contextExtract",
    { system: SYSTEM, messages: [{ role: "user", content: `Conversation:\n${conversation.slice(0, 8000)}` }] },
    { format: { type: "json_schema", schema: CONTEXT_EXTRACT_SCHEMA } },
  );

  let facts: Array<{ category: string; fact: string; stated?: boolean }> = [];
  try {
    if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
    facts = extractStructuredJson<{ facts: Array<{ category: string; fact: string; stated?: boolean }> }>(response.message).facts;
  } catch (e) {
    console.error("[context-extract] Fact extraction parsing failed:", e instanceof Error ? e.message : e);
  }

  const CATS = ["preference", "habit", "commitment", "goal", "person", "work", "general"] as const;
  const added: ContextEntry[] = [];
  for (const f of facts.slice(0, 10)) {
    if (!f.fact) continue;
    const entry = await addContextEntry({
      category: CATS.find((c) => c === f.category) ?? "general",
      fact: f.fact,
      source,
      factSource: f.stated === false ? "guessed" : "said",
    });
    if (entry) added.push(entry);
  }
  return added;
}
