import "server-only";

// Too big: turns one step a student can't face into 2-3 small ones. The result
// is only a suggestion; lib/today-steps.ts checks it and the student confirms.

import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { cleanSplit, type SmallerStep } from "@/lib/today-steps";
import type { Task } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          minutes: { type: "integer" },
        },
        required: ["title", "minutes"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
} as const;

const SYSTEM = `A high school student looked at one step and said it's too big. Break it into 2 or 3 smaller steps they could actually start today.

- Each step is one concrete thing with a visible result, doable in 10 to 30 minutes.
- The first step is the easiest way in. Together the steps should move the work forward; they don't have to finish it.
- Each title reads like a to-do they'd write: 2 to 6 words, starts with a verb, names the real thing ("Read pages 40-45"). Never repeat the project name, no emoji, no trailing period.
- Use only what the task says. Never invent details, names, page numbers or deadlines. If you don't know the specifics, keep the title general.
- No filler: no "get organized", "take a break", "stay focused" or "review your notes".
- minutes is your realistic estimate for that step.`;

export async function splitStep(task: Task, projectTitle?: string): Promise<SmallerStep[] | null> {
  const result = await callClaude(
    "splitStep",
    {
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Step: ${task.title}\nDetails: ${task.notes ?? "(none)"}${projectTitle ? `\nProject: ${projectTitle}` : ""}`,
        },
      ],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) return null;
  try {
    return cleanSplit(extractStructuredJson<unknown>(result.message));
  } catch {
    return null;
  }
}
