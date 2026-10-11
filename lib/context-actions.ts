// What Tell Tangent (Cmd-K) offers before you type: drawn from what Tangent
// knows right now — Tangent's open questions, a day that's too full, the
// nearest deadline, a project's next step — instead of the same generic
// list for everyone. Pure; the palette passes in app state.

import { dayName, DEFAULT_CAPACITY, suggestRelief, type Capacity } from "./load";
import { splitCourse } from "./course";
import { addDaysYMD } from "./time";
import type { Plan, Task } from "./types";

export type ContextAction =
  | { label: string; detail?: string; kind: "ask" | "prefill" | "navigate"; value: string }
  | { label: string; detail?: string; kind: "event"; value: string; eventDetail?: unknown };

function when(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDaysYMD(today, 1)) return "tomorrow";
  return dayName(date);
}

function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
}

export function contextActions(input: {
  tasks: Task[];
  plans: Plan[];
  questionCount: number;
  now: { date: string; minutes: number };
  capacity?: Capacity | null;
}): ContextAction[] {
  const { tasks, plans, questionCount, now } = input;
  const out: ContextAction[] = [];

  if (questionCount > 0) {
    out.push({
      label: `Answer Tangent's ${questionCount} question${questionCount === 1 ? "" : "s"}`,
      detail: "So it can sharpen what you captured",
      kind: "navigate",
      value: "/#questions",
    });
  }

  const relief = suggestRelief(tasks, { now, cap: input.capacity ?? DEFAULT_CAPACITY });
  if (relief) {
    out.push({
      label: `Lighten ${dayName(relief.fromDate)}`,
      detail: `Move "${splitCourse({ title: relief.title, source: undefined }).title}" to ${dayName(relief.toDate)}`,
      kind: "ask",
      value: `Move ${relief.title} to ${dayName(relief.toDate)} at ${clock(relief.toTime)}`,
    });
  }

  const soon = addDaysYMD(now.date, 4);
  const deadline = tasks
    .filter((t) => !t.completed && (t.source === "canvas" || t.kind === "school") && t.date >= now.date && t.date <= soon)
    .filter((t) => t.title.trim().toLowerCase() !== "school")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (deadline) {
    const title = splitCourse(deadline).title;
    out.push({
      label: `Get ahead on ${title}`,
      detail: `Due ${when(deadline.date, now.date)}`,
      kind: "prefill",
      value: `Help me get ${title} done before it's due ${when(deadline.date, now.date)}`,
    });
  }

  const project = plans
    .map((p) => ({ p, next: tasks.filter((t) => t.planId === p.id && !t.completed && t.date >= now.date).sort((a, b) => a.date.localeCompare(b.date))[0] }))
    .filter((x) => x.next)
    .sort((a, b) => a.next!.date.localeCompare(b.next!.date))[0];
  if (project) {
    out.push({
      label: `Next for ${project.p.title}`,
      detail: project.next!.title,
      kind: "navigate",
      value: `/projects/${project.p.id}`,
    });
  }

  out.push({
    label: "Grill me",
    detail: "Tangent asks what it doesn't know yet",
    kind: "event",
    value: "tangent:get-to-know",
    eventDetail: { mode: "grill" },
  });

  return out.slice(0, 5);
}
