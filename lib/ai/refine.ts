import "server-only";

// A saved task, sharpened by the student's answers to Tangent's questions
// (lib/ai/clarify.ts captureQuestions). Returns only what should change; the
// caller applies it, and re-places the task with the spacing brain when the
// answers moved its day or deadline.

import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import type { Task } from "@/lib/types";
import type { CaptureCategory } from "@/lib/capture-category";

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
  /** What kind of thing it is, for its color and calendar (lib/capture-category.ts). */
  category: CaptureCategory;
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
    category: { type: "string", enum: ["academic", "extracurricular", "personal", ""] },
  },
  required: ["title", "notes", "startAction", "date", "time", "deadline", "summary", "category"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write the detail on one task for a high school student: what it's for, what doing it actually involves, how long it takes, and the very first move. You know this student from the context below. When they've answered follow-up questions, use the answers.

The student opens this detail when they sit down to do the task, so every line must help them start and finish THIS task. Generic advice is worse than nothing.

Return the task's fields:
- title: short and specific (e.g. "Chem lab report — titration"). Keep the original if you'd add nothing.
- notes: exactly this structure, one line each:
  GOAL: the concrete result when it's done, in one sentence ("A submitted 2-page titration report with the error analysis"), not a motivation ("Improve your chemistry skills").
  FOCUS: the 2-4 real parts of the work, in order, separated by "; ". Name the actual things: sections, problems, people, materials. Only what this task needs.
  TIME: a realistic total for a high schooler, e.g. "about 45 min" or "2 sessions of 40 min". Base it on what the work is, and on how long things take them if the context says.
- startAction: the first physical action, doable in under 2 minutes, starting with a verb ("Open the lab handout and copy the data table into the doc"). Not "Get started on…", not "Plan…".

- date: YYYY-MM-DD only if the answers say WHEN to do it; otherwise "".
- time: HH:MM only if the answers give a time; otherwise "".
- deadline: YYYY-MM-DD if the answers reveal when it's due; otherwise "".
- summary: one short sentence on what you changed, starting with a verb ("Split into…", "Set it due…").
- category: what this is in the student's life.
  "academic": schoolwork: homework, studying, tests, essays, labs, reading for a class, school forms.
  "extracurricular": anything outside class they're building or part of: clubs, teams, robotics, research, competitions, volunteering, a startup or side project, sports, music, art.
  "personal": errands, chores, appointments, family, friends, health, buying things.
  Use the student context: a name you see among their activities (a club, a project) is extracurricular. "" only if you truly can't tell.

With no answers yet you are tidying the student's raw words, so stay faithful to them:
- Keep their meaning; never invent details, people, subjects or deadlines they didn't say.
- The title reads like a to-do they'd write ("Email Dr. Chann about the booth"), not a rewrite or a summary.
- If it's already clear, return it nearly as is.

Never write filler: no "stay focused", "take breaks", "eliminate distractions", "you've got this", "review your notes" unless notes are the actual work. If you don't know a detail (a page count, a teacher's name), leave it out rather than invent it.

Example. Task "email dr chann about the booth", context says they're a founder of Tangent and Dr. Chann is the faculty supervisor:
GOAL: Dr. Chann knows what you need for the booth and when you need an answer by.
FOCUS: Name the event and its date; say exactly what you need from them; ask one clear question; give a reply-by date.
TIME: about 10 min
startAction: Open a new email to Dr. Chann and write the event name in the subject line.`;

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
          content: `${dateContext}\n\nSTUDENT CONTEXT:\n${studentContext}\n\nTASK:\nTitle: ${task.title}\nDate: ${task.date} ${task.time}\nNotes: ${task.notes ?? ""}\nFirst step: ${task.startAction ?? ""}\n\nTHEIR ANSWERS:\n${qa.length ? qa.map((a) => `- ${a.question} → ${a.answer}`).join("\n") : "(none yet — just tidy the task from what they said; keep date and time empty)"}`,
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
