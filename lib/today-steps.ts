// Today's daily loop: which 1-3 steps to show, and where a step goes when the
// day doesn't go as planned. Pure and AI-free, so the screen and the server
// share one answer. "When" comes from the spacing brain (lib/load.ts).
//
// What never moves: Canvas assignments, recurring tasks, School Blocks,
// commitments and anything with a real due date. Their date is a fact, so a
// student can only set them aside for the day.

import { isDueOnly } from "./dates";
import { type Capacity, estimateMinutes, isMovable, placeTask } from "./load";
import { addDaysYMD } from "./time";
import type { Task } from "./types";
import { tracksCompletion } from "./urgency";

export const MAX_TODAY_STEPS = 3;
/** More missed steps than this is a backlog: Tangent offers Fresh start
 *  instead of quietly reshuffling the student's week. */
export const MAX_AUTO_MOVES = 5;
const CANVAS_AHEAD_DAYS = 2;
const PLACE_WITHIN_DAYS = 13;

type Now = Parameters<typeof placeTask>[1]["now"];
type Context = { now: Now; cap: Capacity };

export type StepMove = { taskId: string; fromDate: string; fromTime: string; date: string; time: string };

function byDateThenTime(a: Task, b: Task): number {
  return (
    a.date.localeCompare(b.date) ||
    Number(isDueOnly(b)) - Number(isDueOnly(a)) ||
    a.time.localeCompare(b.time)
  );
}

/** The steps for today: what's late, then today's, then Canvas work due in the
 *  next two days if there's room. Real due dates go first within a day. */
export function pickTodaySteps(tasks: Task[], today: string, setAside: ReadonlySet<string> = new Set()): Task[] {
  const canvasUntil = addDaysYMD(today, CANVAS_AHEAD_DAYS);
  return tasks
    .filter(
      (t) =>
        !t.completed &&
        tracksCompletion(t) &&
        !setAside.has(t.id) &&
        (t.date <= today || (t.source === "canvas" && t.date <= canvasUntil))
    )
    .sort(byDateThenTime)
    .slice(0, MAX_TODAY_STEPS);
}

/** Tangent may pick a new day for this step. Everything else is set aside. */
export function canMoveStep(task: Task): boolean {
  return isMovable(task) && !isDueOnly(task);
}

/** Moves the chosen steps to `floor` or later without reordering a project:
 *  a project gets at most one moved step a day, and a later step is pushed
 *  only when a moved one lands on or past it. */
function rebuild(tasks: Task[], chosen: (t: Task) => boolean, floor: string, { now, cap }: Context): StepMove[] {
  let working = tasks;
  const moves: StepMove[] = [];
  const planFloor = new Map<string, string>();

  for (const task of tasks.filter(isMovable).sort(byDateThenTime)) {
    const held = task.planId ? planFloor.get(task.planId) : undefined;
    const pushed = held !== undefined && task.date < held && canMoveStep(task);
    if (!chosen(task) && !pushed) {
      if (held !== undefined && task.date >= held) planFloor.delete(task.planId as string);
      continue;
    }
    const earliest = held !== undefined && held > floor ? held : floor;
    const placed = placeTask(
      working.filter((t) => t.id !== task.id),
      {
        now,
        cap,
        minutes: estimateMinutes(task),
        earliest,
        preferredDate: earliest,
        latest: addDaysYMD(earliest, PLACE_WITHIN_DAYS),
      }
    );
    if (!placed) continue;
    if (placed.date !== task.date || placed.time !== task.time) {
      moves.push({ taskId: task.id, fromDate: task.date, fromTime: task.time, date: placed.date, time: placed.time });
      working = working.map((t) => (t.id === task.id ? { ...t, date: placed.date, time: placed.time } : t));
    }
    if (task.planId) planFloor.set(task.planId, addDaysYMD(placed.date, 1));
  }
  return moves;
}

/** A miss: a step that could move, left open past its day. Later today isn't a
 *  miss yet, because the student can still get to it. */
export function missedSteps(tasks: Task[], today: string): Task[] {
  return tasks.filter((t) => canMoveStep(t) && t.date < today);
}

/** The automatic re-plan on a miss. Nothing moves when it's more than a small
 *  correction: the screen offers Fresh start instead. */
export function planMissReplan(tasks: Task[], ctx: Context): { moves: StepMove[]; backlog: boolean } {
  const missed = new Set(missedSteps(tasks, ctx.now.date).map((t) => t.id));
  if (missed.size === 0) return { moves: [], backlog: false };
  const moves = rebuild(tasks, (t) => missed.has(t.id), ctx.now.date, ctx);
  return moves.length > MAX_AUTO_MOVES ? { moves: [], backlog: true } : { moves, backlog: false };
}

/** What Fresh start clears: every open step that could move and whose time has
 *  passed, including today's. The student asked, so due dates they set
 *  themselves move too. */
export function freshStartSteps(tasks: Task[], now: Pick<Now, "date" | "minutes">): Task[] {
  return tasks.filter((t) => {
    if (!isMovable(t)) return false;
    if (t.date < now.date) return true;
    if (t.date > now.date || isDueOnly(t)) return false;
    const [h, m] = t.time.split(":").map(Number);
    return h * 60 + m < now.minutes;
  });
}

export function planFreshStart(tasks: Task[], ctx: Context): StepMove[] {
  const cleared = new Set(freshStartSteps(tasks, ctx.now).map((t) => t.id));
  return cleared.size === 0 ? [] : rebuild(tasks, (t) => cleared.has(t.id), ctx.now.date, ctx);
}

export function planNotToday(tasks: Task[], task: Task, ctx: Context): StepMove[] {
  return rebuild(tasks, (t) => t.id === task.id, addDaysYMD(ctx.now.date, 1), ctx);
}

// ─── Too big ───────────────────────────────────────────────────────────────

export type SmallerStep = { title: string; minutes: number };

const MIN_PIECE = 5;
const MAX_PIECE = 30;
const MAX_PIECES = 3;

/** Keeps a usable split out of whatever the model returned: 2-3 titled pieces
 *  of 5-30 minutes each. Null if there aren't two. */
export function cleanSplit(raw: unknown): SmallerStep[] | null {
  const list = (raw as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(list)) return null;
  const steps: SmallerStep[] = [];
  for (const item of list) {
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, 120) : "";
    if (!title) continue;
    const minutes = Number(item.minutes);
    steps.push({
      title,
      minutes: Number.isFinite(minutes) ? Math.min(MAX_PIECE, Math.max(MIN_PIECE, Math.round(minutes))) : 15,
    });
  }
  return steps.length >= 2 ? steps.slice(0, MAX_PIECES) : null;
}

/** Used when the model isn't available, so Too big always offers something. */
export function fallbackSplit(task: Pick<Task, "title" | "startAction">): SmallerStep[] {
  const title = task.title.replace(/\s*\[[^\]]*\]?\s*$/, "");
  return [
    { title: task.startAction?.trim().slice(0, 120) || `First 15 minutes of ${title}`, minutes: 15 },
    { title: `Keep going on ${title}`, minutes: 25 },
  ];
}

/** Real time slots for the pieces, in order, starting today. */
export function placeSmallerSteps(
  tasks: Task[],
  original: Task,
  pieces: SmallerStep[],
  { now, cap }: Context
): Omit<Task, "id">[] {
  let working = tasks.filter((t) => t.id !== original.id);
  let earliest = now.date;
  return pieces.map((piece, i) => {
    const placed = placeTask(working, { now, cap, minutes: piece.minutes, earliest, preferredDate: earliest }) ?? {
      date: addDaysYMD(earliest, 1),
      time: "16:00",
    };
    earliest = placed.date;
    const next: Omit<Task, "id"> = {
      title: piece.title,
      date: placed.date,
      time: placed.time,
      completed: false,
      kind: original.source === "canvas" ? undefined : original.kind,
      calendarId: original.calendarId,
      planId: original.planId,
      notes: `TIME: about ${piece.minutes} min`,
    };
    working = [...working, { ...next, id: `piece-${i}` }];
    return next;
  });
}
