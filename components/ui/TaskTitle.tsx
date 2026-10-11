// A task's title as students should read it: Canvas items lose their
// bracketed course code and get a small course chip instead
// ("Molarity POGIL  Chem"). See lib/course.ts.

import { splitCourse } from "@/lib/course";
import type { Task } from "@/lib/types";

export default function TaskTitle({ task, chip = true }: { task: Pick<Task, "title" | "source">; chip?: boolean }) {
  const { title, course } = splitCourse(task);
  return (
    <>
      {title}
      {chip && course && <span className="course-chip">{course}</span>}
    </>
  );
}

/** Plain-text version for aria-labels, titles and receipts. */
export function taskTitleText(task: Pick<Task, "title" | "source">): string {
  const { title, course } = splitCourse(task);
  return course ? `${title} (${course})` : title;
}
