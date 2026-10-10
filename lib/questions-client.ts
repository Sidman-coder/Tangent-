// Browser side of "grill me, later" (/api/questions). Every surface that
// saves a task without asking first — the capture mic, ⌘K, quick asks on the
// AI page — calls generateQuestions afterwards; Today and the bell pick the
// set up through QUESTIONS_EVENT.

export type QuestionSet = {
  id: string;
  taskId: string;
  taskTitle: string;
  request: string;
  questions: { id: string; question: string; options: string[] }[];
  createdAt: string;
};

export const QUESTIONS_EVENT = "tangent:questions-changed";

function changed() {
  window.dispatchEvent(new Event(QUESTIONS_EVENT));
}

export async function generateQuestions(taskId: string, request: string): Promise<QuestionSet | null> {
  try {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", taskId, request }),
    });
    const data = (await res.json()) as { ok?: boolean; set?: QuestionSet | null };
    if (data.set) changed();
    return data.set ?? null;
  } catch {
    return null;
  }
}

export async function fetchQuestionSets(): Promise<QuestionSet[]> {
  try {
    const res = await fetch("/api/questions", { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; sets?: QuestionSet[] };
    return data.sets ?? [];
  } catch {
    return [];
  }
}

export async function answerQuestions(
  id: string,
  answers: { id: string; question: string; answer: string }[]
): Promise<{ summary: string | null; actionId?: string; error?: string }> {
  try {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", id, answers }),
    });
    const data = (await res.json()) as { ok?: boolean; summary?: string | null; actionId?: string; error?: string };
    changed();
    if (!res.ok || !data.ok) return { summary: null, error: data.error ?? "Couldn't save that." };
    return { summary: data.summary ?? null, actionId: data.actionId };
  } catch {
    return { summary: null, error: "Couldn't save that." };
  }
}

export async function dismissQuestions(id: string): Promise<void> {
  try {
    await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id }),
    });
  } finally {
    changed();
  }
}
