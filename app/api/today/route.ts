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
import { logStepEvent, logStepEvents } from "@/lib/student/step-events";
import { NOT_TODAY_REASONS, type NotTodayReason } from "@/lib/student/observations";
import { trackEvent } from "@/lib/analytics";
import { DISTRESS_REPLY, isSensitive, looksDistressed } from "@/lib/student/sensitive";
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

type Body = { action?: string; taskId?: string; steps?: unknown; reason?: unknown; feel?: unknown; time?: unknown; note?: unknown };

// Round 4 §3.4: the check-in after Done. Codes only in step_events; the
// optional words stay on the student's own step, as a HOW IT WENT line.
const FEELS = ["nailed", "okay", "struggled"] as const;
const TIME_CODES: Record<string, string> = { less: "faster", about: "about_right", more: "longer" };

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

const isNotTodayReason = (v: unknown): v is NotTodayReason => typeof v === "string" && (NOT_TODAY_REASONS as readonly string[]).includes(v);

export const POST = withUser(async (request: Request) => {
  const { action, taskId, steps, reason, feel, time, note } = (await request.json().catch(() => ({}))) as Body;
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
    logStepEvent({ kind: "not_today", task, code: isNotTodayReason(reason) ? reason : null });
    return NextResponse.json({
      ok: true,
      moved: moves.length,
      actionId,
      date: moves.find((m) => m.taskId === task.id)?.date ?? null,
    });
  }

  if (action === "check_in") {
    const events: { kind: "check_in"; task: Task; code: string }[] = [];
    if (typeof feel === "string" && (FEELS as readonly string[]).includes(feel)) events.push({ kind: "check_in", task, code: feel });
    if (typeof time === "string" && TIME_CODES[time]) events.push({ kind: "check_in", task, code: TIME_CODES[time] });
    if (events.length) logStepEvents(events);
    const said = typeof note === "string" ? note.replace(/\s+/g, " ").trim().slice(0, 280) : "";
    // Teen privacy: health, family or distress never get written down.
    const distressed = Boolean(said) && looksDistressed(said);
    const words = said && !distressed && !isSensitive(said) ? said : "";
    if (words) {
      const kept = (task.notes ?? "").replace(/(?:^|\n)\s*HOW IT WENT:[^\n]*/gi, "").trim();
      await updateTask(task.id, { notes: [kept, `HOW IT WENT: ${words}`].filter(Boolean).join("\n") }).catch(() => null);
    }
    trackEvent("step_check_in", { task_id: task.id, count: events.length });
    return NextResponse.json({ ok: true, reply: distressed ? DISTRESS_REPLY : null });
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
    logStepEvents([{ kind: "too_big", task }, ...added.map((t) => ({ kind: "created" as const, task: t }))]);
    return NextResponse.json({ ok: true, added: added.length, keptOriginal: keepOriginal, actionId: record.id });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
