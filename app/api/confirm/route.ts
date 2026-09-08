import { NextResponse } from "next/server";
import {
  getAppState,
  getAllTasks,
  clearAllTasks,
  getCalendars,
  getTasksMatchingFilter,
  moveTasksToCalendar,
  getPendingConfirmation,
  resolvePendingConfirmation,
  recordAction,
  addVoiceLog,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/** Resolves a confirm-tier gated action (see lib/voice-handler.ts) — either executes
 *  it now (confirm: true) or discards it (confirm: false). Used by CommandPalette's
 *  confirm/cancel prompt. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; confirm?: boolean };
    const id = body.id;
    const confirm = body.confirm === true;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const pending = getPendingConfirmation(id);
    if (!pending) {
      return NextResponse.json({ ok: false, error: "That confirmation has expired." }, { status: 404 });
    }

    resolvePendingConfirmation(id);

    if (!confirm) {
      return NextResponse.json({ ok: true, cancelled: true, response: "Cancelled." });
    }

    if (pending.kind === "delete_all_tasks") {
      const removed = getAllTasks();
      clearAllTasks();
      const record = recordAction("delete_all_tasks", `Cleared ${removed.length} tasks`, { removedTasks: removed });
      addVoiceLog({ text: "(confirmed) clear schedule", response: "Schedule cleared", action: "delete_all_tasks", ok: true });
      return NextResponse.json({
        ok: true,
        action: "delete_all_tasks",
        response: `Cleared ${removed.length} tasks from your schedule.`,
        actionId: record.id,
        state: getAppState(),
      });
    }

    if (pending.kind === "move_tasks") {
      const payload = pending.payload as {
        filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } };
        targetCalendarId: string;
        targetCalendarName: string;
      };
      const calendars = getCalendars();
      const targetCalendar = calendars.find((c) => c.id === payload.targetCalendarId);
      if (!targetCalendar) {
        return NextResponse.json({ ok: false, error: "Target calendar no longer exists." }, { status: 422 });
      }
      const matching = getTasksMatchingFilter(payload.filter);
      const moves = matching.map((t) => ({ taskId: t.id, fromCalendarId: t.calendarId ?? null }));
      const moved = moveTasksToCalendar(payload.filter, targetCalendar.id);
      const record = recordAction("move_tasks", `Moved ${moved} tasks to ${targetCalendar.name}`, { moves });
      addVoiceLog({ text: "(confirmed) move tasks", response: `Moved ${moved} tasks`, action: "move_tasks", ok: true });
      return NextResponse.json({
        ok: true,
        action: "move_tasks",
        moved,
        response: `Moved ${moved} tasks to your ${targetCalendar.name} calendar.`,
        actionId: record.id,
        state: getAppState(),
      });
    }

    return NextResponse.json({ ok: false, error: `Unsupported pending action kind: ${pending.kind}` }, { status: 422 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
