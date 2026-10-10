import "server-only";

// A saved task, sharpened by the student's answers to Tangent's questions
// (lib/ai/clarify.ts captureQuestions). Returns only what should change; the
// caller applies it, and re-places the task with the spacing brain when the
// answers moved its day or deadline.

import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import type { Task } from "@/lib/types";

export type Refinement = {
  title: string;
  notes: string;
  startAction: string;
  /** "" = keep the current day. */
  date: string;
  /** "" = keep the current time. */
  time: string;
  /** Due date the answers revealed, or "". */
  deadline: string;
  /** One plain sentence on what changed, for the student. */
  summary: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    notes: { type: "string" },
    startAction: { type: "string" },
    date: { type: "string" },
    time: { type: "string" },
    deadline: { type: "string" },
    summary: { type: "string" },
  },
  required: ["title", "notes", "startAction", "date", "time", "deadline", "summary"],
  additionalProperties: false,
} as const;

const SYSTEM = `You update one task for a high school student using their answers to your follow-up questions.

Return the task's improved fields:
- title: short and specific (e.g. "Chem lab report — titration"). Keep the original if the answers add nothing.
- notes: keep this structure — GOAL: one sentence. FOCUS: what to do. TIME: realistic estimate like "45 mins total". Use the answers.
- startAction: one concrete first step under 20 words, starting with a verb.
- date: YYYY-MM-DD only if the answers say WHEN to do it; otherwise "".
- time: HH:MM only if the answers give a time; otherwise "".
- deadline: YYYY-MM-DD if the answers reveal when it's due; otherwise "".
- summary: one short sentence on what you changed, starting with a verb ("Split into…", "Set it due…").`;

export async function refineTask(
  task: Task,
  qa: { question: string; answer: string }[],
  studentContext: string,
  dateContext: string
): Promise<Refinement | null> {
  const result = await callClaude(
    "refineTask",
    {
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${dateContext}\n\nSTUDENT CONTEXT:\n${studentContext}\n\nTASK:\nTitle: ${task.title}\nDate: ${task.date} ${task.time}\nNotes: ${task.notes ?? ""}\nFirst step: ${task.startAction ?? ""}\n\nTHEIR ANSWERS:\n${qa.map((a) => `- ${a.question} → ${a.answer}`).join("\n")}`,
        },
      ],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) return null;
  try {
    return extractStructuredJson<Refinement>(result.message);
  } catch {
    return null;
  }
}
