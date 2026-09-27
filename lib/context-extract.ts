import "server-only";
import { getUserContext, addContextEntry, setCompressedSummary } from "@/lib/store";
import type { ContextEntry } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";

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
        },
        required: ["category", "fact"],
        additionalProperties: false,
      },
    },
  },
  required: ["facts"],
  additionalProperties: false,
} as const;

/** Pulls durable facts about the student out of one exchange and adds them to
 *  their context file, compressing it once it passes 40 entries. Runs inside
 *  the caller's user context (the store scopes every write to that student). */
export async function extractContextFacts(conversation: string, source: ContextEntry["source"] = "chat"): Promise<ContextEntry[]> {
  // Extract key facts from a conversation using Haiku
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: `Extract durable facts about the user from this conversation. Only extract things that would remain true for weeks or months. Ignore one-time events and tasks already handled.

Categories: preference (how they like to work), habit (what they regularly do), commitment (recurring schedule), goal (what they are working toward), person (someone they mention), work (their job/projects), general (other durable facts)

If nothing durable is found return an empty facts array.`,
      output_config: { format: { type: "json_schema", schema: CONTEXT_EXTRACT_SCHEMA } },
      messages: [{
        role: "user",
        content: `Conversation:\n${conversation}`,
      }],
    }),
  });

  const data = await response.json();
  let facts: Array<{ category: string; fact: string }> = [];
  try {
    facts = extractStructuredJson<{ facts: Array<{ category: string; fact: string }> }>(data).facts;
  } catch (e) {
    console.error("[context-extract] Fact extraction parsing failed:", e instanceof Error ? e.message : e);
  }

  const added: ContextEntry[] = [];
  for (const f of facts) {
    if (f.fact && f.category) {
      const entry = await addContextEntry({
        category: f.category as ContextEntry["category"],
        fact: f.fact,
        source: source,
      });
      added.push(entry);
    }
  }

  // Check if compression needed — over 40 entries
  const ctx = await getUserContext();
  if (ctx.entries.length > 40) {
    const allFacts = ctx.entries.map((e) => `[${e.category}] ${e.fact}`).join("\n");

    const compressResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: "Compress these user facts into a dense paragraph that preserves all key information. Remove duplicates. Keep it under 350 words. Plain text only.",
        messages: [{ role: "user", content: allFacts }],
      }),
    });

    const compressData = await compressResponse.json();
    const compressed = compressData.content?.[0]?.text || "";
    if (compressed) await setCompressedSummary(compressed);
  }

  return added;
}
