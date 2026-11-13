import "server-only";

// "Bring your context": a student pastes what another AI (Claude, ChatGPT…)
// knows about them, or uploads an export. This pulls out durable facts in
// Tangent's categories for the student to review before anything is saved.

import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import type { ContextEntry } from "@/lib/types";
import { prepareFact } from "@/lib/student/facts";

const CHUNK = 20000;
const MAX_CHUNKS = 4;

const SCHEMA = {
  type: "object",
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["goal", "commitment", "work", "habit", "preference", "person", "general"] },
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

const SYSTEM = `A high school student pasted what another AI assistant knows about them (or a chat export). Pull out durable facts that would help a planner that schedules their schoolwork, activities and goals.

Keep: their school and grade, classes, activities and when they happen, goals (college, career, skills, projects), deadlines that matter, how they like to work, constraints (job, family, transport), people who matter for their plans.
Drop: anything about the AI itself, one-off chat topics, guesses, and anything sensitive: health, mental health, family conflict, relationships, sexuality, religion, substances, money troubles. Leave those out even when they affect scheduling.

Each fact is one short sentence written to the student, in the second person ("You take AP Calculus BC", "You have robotics Tue/Thu until 6"). Be specific; skip anything too vague to plan with. No duplicates. At most 40.

Categories: goal, commitment (recurring schedule), work (classes, school work, jobs), habit (how they work), preference, person, general.`;

export type ImportedFact = { category: ContextEntry["category"]; fact: string };

export async function factsFromText(text: string): Promise<ImportedFact[]> {
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < MAX_CHUNKS; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const r = await callClaude(
        "contextImport",
        { system: SYSTEM, messages: [{ role: "user", content: chunk }] },
        { format: { type: "json_schema", schema: SCHEMA } }
      );
      if (!r.ok) return [] as ImportedFact[];
      try {
        return extractStructuredJson<{ facts: ImportedFact[] }>(r.message).facts;
      } catch {
        return [] as ImportedFact[];
      }
    })
  );
  const seen = new Set<string>();
  const out: ImportedFact[] = [];
  for (const f of results.flat()) {
    // The same filter as saving: the preview never offers what can't be kept.
    const prepared = prepareFact({ category: f.category, fact: f.fact ?? "", source: "manual" });
    if (!prepared.ok) continue;
    const key = prepared.display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ category: f.category, fact: prepared.display });
  }
  return out.slice(0, 60);
}
