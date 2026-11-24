// Round 6 (item 2): the placement check. Runs in code after a plan's steps
// have their days and times, before the draft is shown or anything is saved.
// A step that touches a block (School, a commitment, a fixed task, a busy time
// the student typed) or sits on or after the deadline moves to the nearest
// free slot on a day with room. With no slot, it's dropped and the student is
// asked: "Couldn't fit X before Dec 17; want me to shorten the plan?" Pure.

import type { Task } from "./types";
import type { AvoidWindow } from "./avoid-times";
import type { BusyWindow, Deadline } from "./plan-constraints";
import { busyBlocksOn, firstOpenTime, fixedItemsOn, STEP_BLOCK_MIN, toMinutes } from "./schedule-slots";
import { capacityOn, dayLoad, type Capacity } from "./load";
import { isDatedExam } from "./exam-title";
import { addDaysYMD, weekdayOf } from "./time";

export type StepSlot = { title: string; date: string; time: string; minutes?: number };
export type StepIssue = "overlap" | "deadline" | "past";

export type CheckContext = {
  /** The student's tasks, not including this plan's new steps. */
  tasks: Task[];
  now: { date: string; minutes: number };
  cap: Capacity;
  rules?: { bufferMinutes?: number; preferredWindows?: { start: number; end: number }[]; avoid?: readonly AvoidWindow[] };
  deadline?: Deadline | null;
  /** The last day a moved step may use when there's no deadline (default: a week after it). */
  lastDate?: string;
};

export type CheckResult<T extends StepSlot> = {
  /** Kept steps, in their original order, each with its original `index`. */
  steps: (T & { index: number })[];
  moved: number;
  dropped: { index: number; title: string }[];
  /** One line per dropped step, for the draft's notes. */
  notes: string[];
};

const LEAD_MIN = 60;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-17" → "Dec 17". */
export function shortDate(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

/** The step is the event the deadline is for ("AP Chem final"), so it may sit on its day. */
function isEventStep(step: StepSlot, deadline: Deadline | null | undefined): boolean {
  return !!deadline && step.date === deadline.date && isDatedExam(step.title);
}

/** Why a step can't stay where it is, or null. */
export function stepIssue(step: StepSlot, tasks: Task[], ctx: Pick<CheckContext, "now" | "rules" | "deadline">): StepIssue | null {
  // The event itself ("AP Chem final" on its day) is the student's fixed item, not a step to move.
  if (isEventStep(step, ctx.deadline)) return null;
  if (ctx.deadline && step.date >= ctx.deadline.date) return "deadline";
  const start = toMinutes(step.time);
  if (step.date < ctx.now.date || (step.date === ctx.now.date && start !== null && start < ctx.now.minutes)) return "past";
  if (start === null) return null;
  const end = start + (step.minutes ?? STEP_BLOCK_MIN);
  const blocks = busyBlocksOn(tasks, step.date, { bufferMinutes: ctx.rules?.bufferMinutes, avoid: ctx.rules?.avoid });
  return blocks.some(([b0, b1]) => start < b1 && b0 < end) ? "overlap" : null;
}

function asTask(step: StepSlot, i: number): Task {
  return {
    id: `placed-${i}`,
    title: step.title,
    date: step.date,
    time: step.time,
    completed: false,
    notes: `TIME: ${step.minutes ?? STEP_BLOCK_MIN} min`,
    planId: "new-plan",
    commitment: "flexible",
  };
}

/** The nearest day (same day first, then a day later, a day earlier, …) with room and an open time. */
function nearestSlot(
  working: Task[],
  step: StepSlot,
  ctx: CheckContext,
  stepDays: Set<string>
): { date: string; time: string } | null {
  const minutes = step.minutes ?? STEP_BLOCK_MIN;
  const floor = ctx.now.date;
  const ceiling = ctx.deadline ? addDaysYMD(ctx.deadline.date, -1) : ctx.lastDate ?? addDaysYMD(step.date > floor ? step.date : floor, 7);
  if (ceiling < floor) return null;
  const tryDay = (date: string) => {
    if (date < floor || date > ceiling) return null;
    if (dayLoad(working, date) + minutes > capacityOn(date, ctx.cap)) return null;
    const earliest = date === ctx.now.date ? ctx.now.minutes + LEAD_MIN : 0;
    const time = firstOpenTime(working, date, earliest, minutes, ctx.rules ?? {});
    return time ? { date, time } : null;
  };
  const anchor = step.date > ceiling ? ceiling : step.date < floor ? floor : step.date;
  // First pass keeps one step a day for this plan; the second allows sharing a day.
  for (const shareDay of [false, true]) {
    for (let k = 0; k <= 60; k++) {
      for (const date of k === 0 ? [anchor] : [addDaysYMD(anchor, -k), addDaysYMD(anchor, k)]) {
        if (!shareDay && date !== step.date && stepDays.has(date)) continue;
        const slot = tryDay(date);
        if (slot) return slot;
      }
      if (addDaysYMD(anchor, -k) < floor && addDaysYMD(anchor, k) > ceiling) break;
    }
  }
  return null;
}

/**
 * Moves or drops every step that breaks a hard rule. Kept steps keep their
 * order: the free slots are handed out earliest first, so step 2 never ends
 * up before step 1 because step 1 had to move.
 */
export function checkPlacement<T extends StepSlot>(steps: T[], ctx: CheckContext): CheckResult<T> {
  const working = [...ctx.tasks];
  const kept: (T & { index: number })[] = [];
  const dropped: { index: number; title: string }[] = [];
  const notes: string[] = [];
  let moved = 0;
  const stepDays = new Set<string>();

  steps.forEach((step, index) => {
    let slot: { date: string; time: string } | null = { date: step.date, time: step.time };
    if (stepIssue(step, working, ctx)) {
      slot = nearestSlot(working, step, ctx, stepDays);
      if (slot) moved++;
    }
    if (!slot) {
      dropped.push({ index, title: step.title });
      notes.push(
        ctx.deadline
          ? `Couldn't fit "${step.title}" before ${shortDate(ctx.deadline.date)}; want me to shorten the plan?`
          : `Couldn't fit "${step.title}" this week; want me to shorten the plan?`
      );
      return;
    }
    const placed = { ...step, ...slot, index };
    kept.push(placed);
    working.push(asTask(placed, index));
    stepDays.add(placed.date);
  });

  // Hand the slots out in order (the event, if any, keeps its own). Only when
  // the steps are the same length, so a swap can't make a new overlap.
  const movable = kept.filter((s) => !isEventStep(s, ctx.deadline));
  if (moved === 0 || new Set(movable.map((s) => s.minutes ?? STEP_BLOCK_MIN)).size > 1) return { steps: kept, moved, dropped, notes };
  const slots = movable
    .map((s) => ({ date: s.date, time: s.time }))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  movable.forEach((s, i) => Object.assign(s, slots[i]));

  return { steps: kept, moved, dropped, notes };
}

/** The labelled blocks on a day: School, commitments, fixed tasks and the busy
 *  times the student typed. What a reason or an if-then cue may name. */
export function dayItems(tasks: Task[], date: string, busy: readonly BusyWindow[] = []): { label: string; start: number; end: number }[] {
  const wd = weekdayOf(date);
  const typed = busy.filter((b) => b.weekday === wd).map((b) => ({ label: b.label, start: b.start, end: b.end }));
  return [...fixedItemsOn(tasks, date), ...typed].sort((a, b) => a.end - b.end);
}
