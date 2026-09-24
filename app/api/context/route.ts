import { NextResponse } from "next/server";
import { getUserContext, addContextEntry, setCompressedSummary, getContextAsString } from "@/lib/store";
import type { ContextEntry } from "@/lib/types";
import { extractStructuredJson } from "@/lib/anthropic-json";

export const dynamic = "force-dynamic";

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

export async function GET() {
  return NextResponse.json({
    context: getUserContext(),
    contextString: getContextAsString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "extract") {
      // Extract key facts from a conversation using Haiku
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return NextResponse.json({ ok: false, error: "No API key" });

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
            content: `Conversation:\n${body.conversation}`,
          }],
        }),
      });

      const data = await response.json();
      let facts: Array<{ category: string; fact: string }> = [];
      try {
        facts = extractStructuredJson<{ facts: Array<{ category: string; fact: string }> }>(data).facts;
      } catch (e) {
        console.error("[api/context] Fact extraction parsing failed:", e instanceof Error ? e.message : e);
      }

      const added: ContextEntry[] = [];
      for (const f of facts) {
        if (f.fact && f.category) {
          const entry = addContextEntry({
            category: f.category as ContextEntry["category"],
            fact: f.fact,
            source: body.source || "chat",
          });
          added.push(entry);
        }
      }

      // Check if compression needed — over 40 entries
      const ctx = getUserContext();
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
        if (compressed) setCompressedSummary(compressed);
      }

      return NextResponse.json({ ok: true, added: added.length, entries: added });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/context] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
