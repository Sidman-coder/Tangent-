// A task's title as students should read it in a list: Canvas items lose their
// bracketed course code and get a small course chip instead ("Molarity POGIL
// Chem"); a project's name repeated in front is dropped under that project.
// Stored titles never change; task detail shows the original. See
// lib/clean-title.ts.

import { cleanTaskTitle } from "@/lib/clean-title";
import type { Task } from "@/lib/types";

type TitleTask = Pick<Task, "title" | "source">;

function clean(task: TitleTask, projectName?: string | null) {
  return cleanTaskTitle(task.title, { projectName, course: task.source === "canvas" ? "chip" : "keep" });
}

export default function TaskTitle({ task, chip = true, projectName }: { task: TitleTask; chip?: boolean; projectName?: string | null }) {
  const { title, course } = clean(task, projectName);
  return (
    <>
      {title}
      {chip && course && <span className="course-chip">{course}</span>}
    </>
  );
}

/** Plain-text version for aria-labels, titles and receipts. */
export function taskTitleText(task: TitleTask, projectName?: string | null): string {
  const { title, course } = clean(task, projectName);
  return course ? `${title} (${course})` : title;
}
