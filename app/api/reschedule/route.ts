import { NextResponse } from "next/server";
import { updateTask, recordAction } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { taskId, suggestedDate, suggestedTime } = body as {
    taskId?: string;
    suggestedDate?: string;
    suggestedTime?: string;
  };

  if (!taskId || !suggestedDate || !suggestedTime) {
    return NextResponse.json({ ok: false, error: "Missing taskId, suggestedDate, or suggestedTime" }, { status: 400 });
  }

  const before = updateTask(taskId, {});
  if (!before) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }
  const fromDate = before.date;
  const fromTime = before.time;

  const task = updateTask(taskId, { date: suggestedDate, time: suggestedTime });
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
  }

  const action = recordAction(
    "reschedule_task",
    `Moved "${task.title}" to ${suggestedDate} ${suggestedTime}`,
    { rescheduled: { taskId, fromDate, fromTime } }
  );

  return NextResponse.json({ ok: true, task, actionId: action.id });
}
