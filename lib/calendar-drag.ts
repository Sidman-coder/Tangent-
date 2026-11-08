// The math behind dragging a block on the week grid: where a pointer lands, in
// days and snapped minutes. Pure, so midnight and day boundaries are unit tested.

import type { Task } from "./types";
import { isOnboardingSchoolTask } from "./school-block";

export const SNAP_MIN = 15;
const DAY_MIN = 24 * 60;
/** The last start that stays on the same day. 11:59 PM means "due", so never that. */
export const LATEST_START = DAY_MIN - SNAP_MIN;

export function snapMinutes(minutes: number): number {
  const snapped = Math.round(minutes / SNAP_MIN) * SNAP_MIN;
  return Math.min(LATEST_START, Math.max(0, snapped));
}

export function pixelsToMinutes(offsetPx: number, hourPx: number): number {
  return snapMinutes((offsetPx / hourPx) * 60);
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Which day column an x offset is over; off either edge means the nearest day. */
export function columnAt(offsetX: number, gridWidth: number, columns: number): number {
  if (gridWidth <= 0 || columns <= 0) return 0;
  return Math.min(columns - 1, Math.max(0, Math.floor(offsetX / (gridWidth / columns))));
}

export type DropInput = {
  /** Pointer position relative to the top left of the first day column. */
  x: number;
  y: number;
  /** How far down the block it was grabbed, so it doesn't jump to the pointer. */
  grabY: number;
  gridWidth: number;
  hourPx: number;
  days: string[];
};

export function dropTarget(input: DropInput): { ymd: string; minutes: number } {
  return {
    ymd: input.days[columnAt(input.x, input.gridWidth, input.days.length)],
    minutes: pixelsToMinutes(input.y - input.grabY, input.hourPx),
  };
}

/** Canvas deadlines and School Blocks are facts, not plans: they stay put. So do
 *  11:59 PM due dates, which sit in the Due row rather than on the grid. */
export function canDragTask(task: Pick<Task, "source" | "time"> & Task): boolean {
  return task.source !== "canvas" && task.time !== "23:59" && !isOnboardingSchoolTask(task);
}

/** The first other block this start would sit on top of (a warning, not a stop). */
export function overlapAt<T extends { id: string; time: string }>(tasks: T[], taskId: string, minutes: number, blockMin: number): T | null {
  return tasks.find((t) => t.id !== taskId && Math.abs(timeToMinutes(t.time) - minutes) < blockMin) ?? null;
}

/** Alt + arrow keys: the keyboard way to move a block. Null when it can't go further. */
export function nudge(dayIndex: number, minutes: number, key: string, dayCount: number): { dayIndex: number; minutes: number } | null {
  if (key === "ArrowUp" && minutes > 0) return { dayIndex, minutes: snapMinutes(minutes - SNAP_MIN) };
  if (key === "ArrowDown" && minutes < LATEST_START) return { dayIndex, minutes: snapMinutes(minutes + SNAP_MIN) };
  if (key === "ArrowLeft" && dayIndex > 0) return { dayIndex: dayIndex - 1, minutes };
  if (key === "ArrowRight" && dayIndex < dayCount - 1) return { dayIndex: dayIndex + 1, minutes };
  return null;
}
