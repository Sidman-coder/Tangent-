import { NextResponse } from "next/server";
import { splitStep } from "@/lib/ai/split";
import { isMovable } from "@/lib/load";
import { isDueOnly } from "@/lib/dates";
import { studentCapacity, studentNow } from "@/lib/spacing";
import {
  addTask,
  addTasksToPlan,
  deleteTask,
  getAllTasks,
  getPlanById,
  recordAction,
  updateTask,
} from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { trackEvent } from "@/lib/analytics";
import {
  type StepMove,
  canMoveStep,
  cleanSplit,
  fallbackSplit,
  placeSmallerSteps,
  planFreshStart,
  planMissReplan,
  planNotToday,
} from "@/lib/today-steps";
import type { Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Too big asks Claude for smaller steps.
export const maxDuration = 60;

type Body = { action?: string; taskId?: string; steps?: unknown };

/** Applies the moves and records them as one Undo. Whatever landed before a
 *  failure is still recorded, so it can be undone. */
async function applyMoves(moves: StepMove[], summary: string): Promise<string | null> {
  if (moves.length === 0) return null;
  const done: StepMove[] = [];
  let failed: unknown = null;
  for (const move of moves) {
    try {
      if (await updateTask(move.taskId, { date: move.date, time: move.time })) done.push(move);
    } catch (e) {
      failed = e;
      break;
    }
  }
  const action = done.length
    ? await recordAction("reschedule_task", summary, {
        rescheduledMany: done.map(({ taskId, fromDate, fromTime }) => ({ taskId, fromDate, fromTime })),
      })
    : null;
  if (failed) throw failed;
  return action?.id ?? null;
}

function plural(n: number): string {
  return `${n} step${n === 1 ? "" : "s"}`;
}

export const POST = withUser(async (request: Request) => {
  const { action, taskId, steps } = (await request.json().catch(() => ({}))) as Body;
  const [tasks, { cap }, now] = await Promise.all([getAllTasks(), studentCapacity(), studentNow()]);
  const ctx = { now, cap };

  if (action === "replan") {
    const { moves, backlog } = planMissReplan(tasks, ctx);
    const actionId = await applyMoves(moves, `Re-planned ${plural(moves.length)} from an earlier day`);
    trackEvent("auto_replan", { count: moves.length });
    return NextResponse.json({ ok: true, moved: moves.length, actionId, backlog });
  }

  if (action === "fresh_start") {
    const moves = planFreshStart(tasks, ctx);
    const actionId = await applyMoves(moves, `Fresh start: moved ${plural(moves.length)}`);
    trackEvent("fresh_start", { count: moves.length });
    return NextResponse.json({ ok: true, moved: moves.length, actionId });
  }

  const task: Task | undefined = tasks.find((t) => t.id === taskId);
  if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });

  if (action === "not_today") {
    // The screen sets these aside itself: their dates are facts.
    if (!canMoveStep(task)) return NextResponse.json({ ok: true, moved: 0, actionId: null });
    const moves = planNotToday(tasks, task, ctx);
    const actionId = await applyMoves(moves, `Moved "${task.title}" off today`);
    trackEvent("not_today", { task_id: task.id, count: moves.length });
    return NextResponse.json({
      ok: true,
      moved: moves.length,
      actionId,
      date: moves.find((m) => m.taskId === task.id)?.date ?? null,
    });
  }

  if (action === "split_preview") {
    const plan = task.planId ? await getPlanById(task.planId).catch(() => null) : null;
    const smaller = await splitStep(task, plan?.title).catch(() => null);
    return NextResponse.json({ ok: true, steps: smaller ?? fallbackSplit(task) });
  }

  if (action === "split_apply") {
    const pieces = cleanSplit({ steps });
    if (!pieces) return NextResponse.json({ ok: false, error: "Those steps can't be used" }, { status: 400 });
    // A deadline, a repeating task or a Path step stays: only the original
    // knows that date or link, so the pieces go alongside it.
    const keepOriginal = !isMovable(task) || isDueOnly(task) || Boolean(task.pathNodeId);
    const placed = placeSmallerSteps(tasks, task, pieces, ctx);
    const added: Task[] = [];
    if (task.planId) {
      const fresh = placed.map(({ planId: _plan, ...rest }) => rest);
      added.push(...(await addTasksToPlan(task.planId, fresh)).tasks);
    } else {
      for (const piece of placed) {
        const created = await addTask(piece);
        if (!created.wasDuplicate) added.push(created);
      }
    }
    if (!keepOriginal) await deleteTask(task.id);
    const record = await recordAction("delete_task", `Split "${task.title}" into ${plural(added.length)}`, {
      addedTaskIds: added.map((t) => t.id),
      removedTasks: keepOriginal ? [] : [task],
    });
    trackEvent("too_big", { task_id: task.id, count: added.length });
    return NextResponse.json({ ok: true, added: added.length, keptOriginal: keepOriginal, actionId: record.id });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
