import { NextResponse } from "next/server";
import {
  getAppState,
  addTask,
  completeTask,
  deleteTask,
  toggleTask,
  updateTask,
  addRecurringTask,
  deleteRecurringTask,
  updateRecurringTask,
} from "@/lib/store";
import type { Priority } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET — returns full AppState for polling by the frontend */
export async function GET() {
  const taskCount = getAppState().tasks.length;
  console.log("[api/tasks] GET — returning state. Task count:", taskCount);
  return NextResponse.json(getAppState());
}

/** POST — executes a task action against the store */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      id?: string;
      title?: string;
      date?: string;
      time?: string;
      priority?: string;
      completed?: boolean;
      calendarId?: string | null;
      // recurring
      frequency?: string;
      daysOfWeek?: number[];
      endDate?: string;
      occurrences?: number;
      deleteAll?: boolean;
      updateAll?: boolean;
      patch?: Record<string, unknown>;
      notes?: string;
    };

    console.log("[api/tasks] POST action:", body.action, "| title:", body.title, "| date:", body.date);

    const action = body.action;

    if (action === "add_task") {
      if (!body.title?.trim()) {
        return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
      }
      const task = addTask({
        title: body.title.trim(),
        date: body.date ?? new Date().toISOString().slice(0, 10),
        time: body.time ?? "09:00",
        priority: (["high", "medium", "low"].includes(body.priority ?? "") ? body.priority : "medium") as Priority,
        completed: false,
        calendarId: body.calendarId ?? null,
        notes: body.notes?.trim() || undefined,
      });
      if (task.wasDuplicate) {
        console.log("[api/tasks] add_task skipped duplicate:", task.id);
        return NextResponse.json({ ok: true, task, wasDuplicate: true, state: getAppState() });
      }
      console.log("[api/tasks] add_task success:", task.id);
      return NextResponse.json({ ok: true, task, state: getAppState() });
    }

    if (action === "complete_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const task = completeTask(body.id);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] complete_task success:", body.id);
      return NextResponse.json({ ok: true, task, state: getAppState() });
    }

    if (action === "delete_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const removed = deleteTask(body.id);
      if (!removed) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] delete_task success:", body.id);
      return NextResponse.json({ ok: true, state: getAppState() });
    }

    if (action === "toggle_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const task = toggleTask(body.id);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] toggle_task success:", body.id, "->", task.completed);
      return NextResponse.json({ ok: true, task, state: getAppState() });
    }

    if (action === "update_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const patch: Parameters<typeof updateTask>[1] = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.date !== undefined) patch.date = body.date;
      if (body.time !== undefined) patch.time = body.time;
      if (body.priority !== undefined && ["high", "medium", "low"].includes(body.priority)) {
        patch.priority = body.priority as Priority;
      }
      if (body.completed !== undefined) patch.completed = body.completed;
      const task = updateTask(body.id, patch);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] update_task success:", body.id);
      return NextResponse.json({ ok: true, task, state: getAppState() });
    }

    if (action === "add_recurring_task") {
      if (!body.title?.trim()) {
        return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
      }
      const freq = body.frequency;
      if (freq !== "daily" && freq !== "weekly" && freq !== "monthly" && freq !== "yearly") {
        return NextResponse.json({ ok: false, error: "frequency must be daily|weekly|monthly|yearly" }, { status: 400 });
      }
      const tasks = addRecurringTask(
        {
          title: body.title.trim(),
          date: body.date ?? new Date().toISOString().slice(0, 10),
          time: body.time ?? "09:00",
          priority: (["high", "medium", "low"].includes(body.priority ?? "") ? body.priority : "medium") as Priority,
          completed: false,
          calendarId: body.calendarId ?? null,
          notes: body.notes?.trim() || undefined,
        },
        {
          frequency: freq,
          daysOfWeek: body.daysOfWeek,
          endDate: body.endDate,
          occurrences: body.occurrences,
        }
      );
      console.log("[api/tasks] add_recurring_task created:", tasks.length, "instances");
      return NextResponse.json({ ok: true, count: tasks.length, state: getAppState() });
    }

    if (action === "delete_recurring") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const removed = deleteRecurringTask(body.id, body.deleteAll ?? false);
      console.log("[api/tasks] delete_recurring — id:", body.id, "| deleteAll:", body.deleteAll, "| removed:", removed);
      return NextResponse.json({ ok: true, removed, state: getAppState() });
    }

    if (action === "update_recurring") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const updated = updateRecurringTask(body.id, body.patch ?? {}, body.updateAll ?? false);
      console.log("[api/tasks] update_recurring — id:", body.id, "| updateAll:", body.updateAll, "| updated:", updated);
      return NextResponse.json({ ok: true, updated, state: getAppState() });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/tasks] POST error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
