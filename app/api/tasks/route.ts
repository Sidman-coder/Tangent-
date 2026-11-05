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
  getUserTimezone,
  recordAction,
} from "@/lib/store";
import { getUserToday } from "@/lib/time";
import type { TaskCommitment, TaskKind } from "@/lib/types";
import { withUser } from "@/lib/request-context";

const TASK_KINDS: TaskKind[] = ["school", "academic-ec", "side-ec", "personal", "commitment"];
const COMMITMENTS: TaskCommitment[] = ["fixed", "reminder", "flexible"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET — returns full AppState for polling by the frontend */
export const GET = withUser(async () => {
  const state = await getAppState();
  return NextResponse.json(state);
});

/** POST — executes a task action against the store */
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as {
      action?: string;
      id?: string;
      title?: string;
      date?: string;
      time?: string;
      kind?: string;
      commitment?: string;
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
      ids?: unknown;
    };

    console.log("[api/tasks] POST action:", body.action);

    const action = body.action;

    if (action === "add_task") {
      if (!body.title?.trim()) {
        return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
      }
      const task = await addTask({
        title: body.title.trim(),
        date: body.date ?? getUserToday(await getUserTimezone()),
        time: body.time ?? "09:00",
        kind: TASK_KINDS.includes(body.kind as TaskKind) ? (body.kind as TaskKind) : undefined,
        completed: false,
        calendarId: body.calendarId ?? null,
        notes: body.notes?.trim() || undefined,
      });
      if (task.wasDuplicate) {
        console.log("[api/tasks] add_task skipped duplicate:", task.id);
        return NextResponse.json({ ok: true, task, wasDuplicate: true, state: await getAppState() });
      }
      console.log("[api/tasks] add_task success:", task.id);
      return NextResponse.json({ ok: true, task, state: await getAppState() });
    }

    if (action === "complete_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const task = await completeTask(body.id);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] complete_task success:", body.id);
      return NextResponse.json({ ok: true, task, state: await getAppState() });
    }

    if (action === "delete_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      // Snapshot first so the calendar's "Remove" can be undone (same undo
      // record the confirmed voice delete uses).
      const before = await updateTask(body.id, {});
      const removed = await deleteTask(body.id);
      if (!removed) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      const record = before ? await recordAction("delete_task", `Removed "${before.title}"`, { removedTasks: [before] }) : null;
      console.log("[api/tasks] delete_task success:", body.id);
      return NextResponse.json({ ok: true, actionId: record?.id, state: await getAppState() });
    }

    // Master fix Phase 5: the calendar's Remove with several tasks picked.
    // One undo record restores them all.
    if (action === "delete_tasks") {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
      if (ids.length === 0) {
        return NextResponse.json({ ok: false, error: "ids are required" }, { status: 400 });
      }
      const removedTasks = [];
      for (const id of ids.slice(0, 100)) {
        const before = await updateTask(id, {});
        if (before && (await deleteTask(id))) removedTasks.push(before);
      }
      if (removedTasks.length === 0) return NextResponse.json({ ok: false, error: "Tasks not found" }, { status: 404 });
      const label = removedTasks.length === 1 ? `Removed "${removedTasks[0].title}"` : `Removed ${removedTasks.length} tasks`;
      const record = await recordAction("delete_task", label, { removedTasks });
      return NextResponse.json({ ok: true, actionId: record?.id, removed: removedTasks.length, state: await getAppState() });
    }

    if (action === "toggle_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const task = await toggleTask(body.id);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] toggle_task success:", body.id, "->", task.completed);
      return NextResponse.json({ ok: true, task, state: await getAppState() });
    }

    if (action === "update_task") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const patch: Parameters<typeof updateTask>[1] = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.date !== undefined) patch.date = body.date;
      if (body.time !== undefined) patch.time = body.time;
      if (body.kind !== undefined && TASK_KINDS.includes(body.kind as TaskKind)) {
        patch.kind = body.kind as TaskKind;
      }
      if (body.completed !== undefined) patch.completed = body.completed;
      const task = await updateTask(body.id, patch);
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      console.log("[api/tasks] update_task success:", body.id);
      return NextResponse.json({ ok: true, task, state: await getAppState() });
    }

    // The Type selector in task detail. `saved` is false until the column exists.
    if (action === "set_commitment") {
      if (!body.id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      if (!COMMITMENTS.includes(body.commitment as TaskCommitment)) {
        return NextResponse.json({ ok: false, error: "commitment must be fixed|reminder|flexible" }, { status: 400 });
      }
      const commitment = body.commitment as TaskCommitment;
      const before = await updateTask(body.id, {});
      if (!before) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      const task = await updateTask(body.id, { commitment });
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      const saved = task.commitment === commitment;
      const record = saved
        ? await recordAction("reschedule_task", `Changed the type of "${task.title}"`, {
            restoredFields: [{ taskId: task.id, fields: { commitment: before.commitment ?? null } }],
          })
        : null;
      return NextResponse.json({ ok: true, task, saved, actionId: record?.id ?? null, state: await getAppState() });
    }

    // Dismiss on an overdue row: hides it, without completing or deleting it.
    if (action === "dismiss_overdue") {
      if (!body.id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      const before = await updateTask(body.id, {});
      if (!before) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      const task = await updateTask(body.id, { overdueDismissedAt: new Date().toISOString() });
      if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
      const saved = Boolean(task.overdueDismissedAt);
      const record = saved
        ? await recordAction("reschedule_task", `Dismissed "${task.title}"`, {
            restoredFields: [{ taskId: task.id, fields: { overdueDismissedAt: before.overdueDismissedAt ?? null } }],
          })
        : null;
      return NextResponse.json({ ok: true, task, saved, actionId: record?.id ?? null, state: await getAppState() });
    }

    if (action === "add_recurring_task") {
      if (!body.title?.trim()) {
        return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
      }
      const freq = body.frequency;
      if (freq !== "daily" && freq !== "weekly" && freq !== "monthly" && freq !== "yearly") {
        return NextResponse.json({ ok: false, error: "frequency must be daily|weekly|monthly|yearly" }, { status: 400 });
      }
      const tasks = await addRecurringTask(
        {
          title: body.title.trim(),
          date: body.date ?? getUserToday(await getUserTimezone()),
          time: body.time ?? "09:00",
          kind: TASK_KINDS.includes(body.kind as TaskKind) ? (body.kind as TaskKind) : undefined,
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
      return NextResponse.json({ ok: true, count: tasks.length, state: await getAppState() });
    }

    if (action === "delete_recurring") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const removed = await deleteRecurringTask(body.id, body.deleteAll ?? false);
      console.log("[api/tasks] delete_recurring — id:", body.id, "| deleteAll:", body.deleteAll, "| removed:", removed);
      return NextResponse.json({ ok: true, removed, state: await getAppState() });
    }

    if (action === "update_recurring") {
      if (!body.id) {
        return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      }
      const updated = await updateRecurringTask(body.id, body.patch ?? {}, body.updateAll ?? false);
      console.log("[api/tasks] update_recurring — id:", body.id, "| updateAll:", body.updateAll, "| updated:", updated);
      return NextResponse.json({ ok: true, updated, state: await getAppState() });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/tasks] POST error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
