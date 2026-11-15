// Round 5A 4.1: a plan drafted in the Calendar rail shows on the main
// calendar before it's confirmed. Each add_task op (and each repeat of a
// series) becomes a stand-in Task with a "draft:" id, in its project's
// colour; real tasks go grey while the draft is up. Pure: the date and
// colour rules come in from lib/preview-week.ts (opDates, addedColor).

import type { ChangeSet } from "./pipeline/changeset";
import type { Task } from "./types";

export const DRAFT_TASK_PREFIX = "draft:";

export const isDraftTask = (t: Pick<Task, "id">): boolean => t.id.startsWith(DRAFT_TASK_PREFIX);

export type DraftStep = Task & { draftColor: string };

type AddTask = Extract<ChangeSet["ops"][number], { op: "add_task" }>;

/** The proposed steps as calendar tasks, one per date they land on. */
export function draftTasks(
  ops: readonly ChangeSet["ops"][number][],
  rules: { datesOf: (op: AddTask) => string[]; colorOf: (op: AddTask) => string }
): DraftStep[] {
  const out: DraftStep[] = [];
  ops.forEach((op, i) => {
    if (op.op !== "add_task") return;
    const color = rules.colorOf(op);
    for (const date of rules.datesOf(op)) {
      out.push({
        id: `${DRAFT_TASK_PREFIX}${i}:${date}`,
        title: op.title,
        date,
        time: op.time ?? "",
        completed: false,
        kind: op.kind,
        commitment: op.commitment,
        notes: op.notes,
        planId: op.plan_id ?? null,
        draftColor: color,
      });
    }
  });
  return out;
}
