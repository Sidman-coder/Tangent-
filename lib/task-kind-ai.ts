// The rules in lib/task-kind.ts answer most titles. For the ones they aren't sure
// of, one tiny Haiku call at capture, cached for the life of the server process.
// Saving never waits on this going well: any failure reads as the calm default.

import "server-only";
import { callClaude } from "./ai/call";
import { extractStructuredJson } from "./anthropic-json";
import { classifyWithAsk, createClassifyCache, type ClassifyInput, type TaskClassification } from "./task-kind";
import type { TaskCommitment } from "./types";

const SCHEMA = {
  type: "object",
  properties: { kind: { type: "string", enum: ["fixed", "reminder", "flexible"] } },
  required: ["kind"],
  additionalProperties: false,
} as const;

const SYSTEM = `Sort a student's task into one kind.
fixed: something they must show up to at a set time, like an appointment, class, game or exam.
reminder: a small errand or thing not to forget, like calling someone or turning in a form.
flexible: work they can do whenever, like studying, reading or practicing.
If you are not sure, answer flexible.`;

const cache = createClassifyCache(500);

async function askHaiku(input: ClassifyInput): Promise<TaskCommitment | null> {
  const result = await callClaude(
    "classifyCommitment",
    {
      system: SYSTEM,
      messages: [{ role: "user", content: `Task: ${input.title.slice(0, 200)}\nHas a set time: ${input.hasFixedTime ? "yes" : "no"}` }],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) {
    console.warn("[task-kind] call failed:", result.status);
    return null;
  }
  try {
    return extractStructuredJson<{ kind: TaskCommitment }>(result.message).kind;
  } catch {
    return null;
  }
}

export function classifyWithFallback(input: ClassifyInput): Promise<TaskClassification> {
  return classifyWithAsk(input, askHaiku, cache);
}
