import "server-only";

// Tangent's open questions about saved tasks ("grill me, later"). Kept as
// notifications — type proactive_suggestion with actionData.kind "questions"
// — so they need no new table and also show up in the bell. One live set per
// task (the notifications dedup index guarantees it).

import { addNotification, dismissNotification, getNotifications } from "@/lib/store";
import type { ClarifyQuestion } from "@/lib/ai/clarify";
import type { Notification } from "@/lib/types";

export type QuestionSet = {
  id: string;
  taskId: string;
  taskTitle: string;
  request: string;
  questions: ClarifyQuestion[];
  createdAt: string;
};

type QuestionData = {
  kind: "questions";
  taskId: string;
  taskTitle: string;
  request: string;
  questions: ClarifyQuestion[];
};

function isQuestionData(d: unknown): d is QuestionData {
  return !!d && typeof d === "object" && (d as QuestionData).kind === "questions" && Array.isArray((d as QuestionData).questions);
}

export function questionSetFrom(n: Notification): QuestionSet | null {
  if (n.type !== "proactive_suggestion" || !isQuestionData(n.actionData)) return null;
  const d = n.actionData;
  return { id: n.id, taskId: d.taskId, taskTitle: d.taskTitle, request: d.request, questions: d.questions, createdAt: n.timestamp };
}

export async function openQuestionSets(): Promise<QuestionSet[]> {
  return (await getNotifications()).map(questionSetFrom).filter((q): q is QuestionSet => q !== null);
}

export async function queueQuestions(
  task: { id: string; title: string },
  request: string,
  questions: ClarifyQuestion[]
): Promise<QuestionSet | null> {
  if (questions.length === 0) return null;
  const n = await addNotification({
    type: "proactive_suggestion",
    title: questions.length === 1 ? "Tangent has a question" : `Tangent has ${questions.length} questions`,
    body: `About "${task.title}"`,
    actionLabel: "Answer",
    actionData: { kind: "questions", taskId: task.id, taskTitle: task.title, request, questions } satisfies QuestionData,
  });
  return questionSetFrom(n);
}

export async function closeQuestions(id: string): Promise<void> {
  await dismissNotification(id);
}
