import { NextResponse } from "next/server";
import {
  getAppState,
  getAllTasks,
  clearAllTasks,
  getCalendars,
  getTasksMatchingFilter,
  moveTasksToCalendar,
  getPendingConfirmation,
  getOpenPendingConfirmations,
  resolvePendingConfirmation,
  recordAction,
  addVoiceLog,
  deleteEmptiedPlans,
  deleteTask,
  deleteTasks,
  updateTask,
} from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";

/** Plans the confirmation said would go too (lib/voice-handler.ts proposeDelete). */
function planIdsOf(payload: Record<string, unknown>): string[] {
  return Array.isArray(payload.planIds) ? payload.planIds.filter((id): id is string => typeof id === "string") : [];
}

/** " and the plan "SAT Prep"" (inline) or " Also removed the plan "SAT Prep"." */
function plansNote(plans: { title: string }[], inline = false): string {
  if (plans.length === 0) return "";
  const names = plans.map((p) => `"${p.title}"`).join(", ");
  const noun = plans.length === 1 ? "the plan" : "the plans";
  return inline ? ` and ${noun} ${names}` : ` Also removed ${noun} ${names}.`;
}
export const dynamic = "force-dynamic";

/** Open confirmations (id + message only) so the AI console can restore
 *  Confirm/Cancel on a reloaded chat. Payloads stay server-side. */
export const GET = withUser(async () => {
  try {
    const pending = await getOpenPendingConfirmations();
    return NextResponse.json({ ok: true, pending: pending.map((p) => ({ id: p.id, message: p.message })) });
  } catch (e) {
    console.error("[api/confirm] GET error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Couldn't load confirmations." }, { status: 500 });
  }
});

/** Resolves a confirm-tier gated action (see lib/voice-handler.ts) — either executes
 *  it now (confirm: true) or discards it (confirm: false). Used by CommandPalette's
 *  confirm/cancel prompt. */
export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as { id?: string; confirm?: boolean };
    const id = body.id;
    const confirm = body.confirm === true;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const pending = await getPendingConfirmation(id);
    if (!pending) {
      return NextResponse.json({ ok: false, error: "That confirmation has expired." }, { status: 404 });
    }

    // Removing the row is the claim: only one of two racing requests gets true.
    if (!(await resolvePendingConfirmation(id))) {
      return NextResponse.json({ ok: false, error: "That confirmation has expired." }, { status: 404 });
    }

    if (!confirm) {
      return NextResponse.json({ ok: true, cancelled: true, response: "Cancelled." });
    }

    if (pending.kind === "delete_all_tasks") {
      const removed = await getAllTasks();
      await clearAllTasks();
      const removedPlans = await deleteEmptiedPlans(planIdsOf(pending.payload));
      const record = await recordAction("delete_all_tasks", `Cleared ${removed.length} tasks`, { removedTasks: removed, removedPlans });
      await addVoiceLog({ text: "(confirmed) clear schedule", response: "Schedule cleared", action: "delete_all_tasks", ok: true });
      return NextResponse.json({
        ok: true,
        action: "delete_all_tasks",
        response: `Cleared ${removed.length} tasks from your schedule.${plansNote(removedPlans)}`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    if (pending.kind === "move_tasks") {
      const payload = pending.payload as {
        filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } };
        targetCalendarId: string;
        targetCalendarName: string;
      };
      const calendars = await getCalendars();
      const targetCalendar = calendars.find((c) => c.id === payload.targetCalendarId);
      if (!targetCalendar) {
        return NextResponse.json({ ok: false, error: "Target calendar no longer exists." }, { status: 422 });
      }
      const matching = await getTasksMatchingFilter(payload.filter);
      const moves = matching.map((t) => ({ taskId: t.id, fromCalendarId: t.calendarId ?? null }));
      const moved = await moveTasksToCalendar(payload.filter, targetCalendar.id);
      const record = await recordAction("move_tasks", `Moved ${moved} tasks to ${targetCalendar.name}`, { moves });
      await addVoiceLog({ text: "(confirmed) move tasks", response: `Moved ${moved} tasks`, action: "move_tasks", ok: true });
      return NextResponse.json({
        ok: true,
        action: "move_tasks",
        moved,
        response: `Moved ${moved} tasks to your ${targetCalendar.name} calendar.`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    if (pending.kind === "delete_task" && Array.isArray(pending.payload.taskIds)) {
      // A scoped bulk delete ("all of the SAT tasks", lib/delete-scope.ts): only
      // the tasks listed when it was proposed, and only those still there.
      const ids = new Set(pending.payload.taskIds as string[]);
      const found = (await getAllTasks()).filter((t) => ids.has(t.id));
      if (found.length === 0) {
        return NextResponse.json({ ok: false, error: "Those tasks no longer exist." }, { status: 422 });
      }
      await deleteTasks(found.map((t) => t.id));
      const removedPlans = await deleteEmptiedPlans(planIdsOf(pending.payload));
      const label = typeof pending.payload.label === "string" ? ` "${pending.payload.label}"` : "";
      const summary = `Deleted ${found.length}${label} task${found.length === 1 ? "" : "s"}${plansNote(removedPlans, true)}`;
      const record = await recordAction("delete_task", summary, { removedTasks: found, removedPlans });
      await addVoiceLog({ text: "(confirmed) delete tasks", response: summary, action: "delete_task", ok: true });
      return NextResponse.json({
        ok: true,
        action: "delete_task",
        response: `${summary}.`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    if (pending.kind === "delete_task") {
      const payload = pending.payload as { taskId: string; title: string };
      const found = (await getAllTasks()).find((t) => t.id === payload.taskId);
      if (!found) {
        return NextResponse.json({ ok: false, error: "That task no longer exists." }, { status: 422 });
      }
      await deleteTask(found.id);
      const removedPlans = await deleteEmptiedPlans(planIdsOf(pending.payload));
      const summary = `Deleted "${found.title}"${plansNote(removedPlans, true)}`;
      const record = await recordAction("delete_task", summary, { removedTasks: [found], removedPlans });
      await addVoiceLog({ text: "(confirmed) delete task", response: summary, action: "delete_task", ok: true });
      return NextResponse.json({
        ok: true,
        action: "delete_task",
        response: `${summary}.`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    if (pending.kind === "reschedule_task") {
      // Queued by the no-AI router (lib/ai/router.ts): "move X to Friday at 4pm".
      const payload = pending.payload as { taskId: string; title: string; date: string; time: string };
      const found = (await getAllTasks()).find((t) => t.id === payload.taskId);
      if (!found) {
        return NextResponse.json({ ok: false, error: "That task no longer exists." }, { status: 422 });
      }
      const task = await updateTask(found.id, { date: payload.date, time: payload.time });
      const record = await recordAction("reschedule_task", `Moved "${found.title}"`, {
        rescheduled: { taskId: found.id, fromDate: found.date, fromTime: found.time },
      });
      await addVoiceLog({ text: "(confirmed) reschedule task", response: `Moved "${found.title}"`, action: "reschedule_task", ok: true });
      return NextResponse.json({
        ok: true,
        action: "reschedule_task",
        task,
        response: `Moved "${found.title}".`,
        actionId: record.id,
        state: await getAppState(),
      });
    }

    return NextResponse.json({ ok: false, error: `Unsupported pending action kind: ${pending.kind}` }, { status: 422 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
