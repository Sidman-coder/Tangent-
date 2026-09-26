// What needs the student's attention right now, derived only from existing
// Task fields (date, time, completed, kind, source). Pure — no store access —
// so the dashboard, and anything else later, can share one definition.

import type { Task } from "./types";
import { toYMD } from "./dates";

/** Scheduled tasks starting within this window count as "soon". */
export const SOON_WINDOW_MINUTES = 180;
/** Canvas items are real deadlines, so they surface further ahead. */
export const CANVAS_DEADLINE_WINDOW_HOURS = 48;

export type AttentionReason =
  | { type: "overdue"; daysLate: number }
  | { type: "slipped"; minutesLate: number }
  | { type: "soon"; minutesUntil: number }
  | { type: "deadline"; hoursUntil: number };

export type AttentionItem = {
  task: Task;
  reason: AttentionReason;
  /** 0–1 contribution of this item to overall urgency. */
  weight: number;
};

export type UrgencyLevel = "clear" | "low" | "elevated" | "high";

export type UrgencySummary = {
  items: AttentionItem[];
  overdueCount: number;
  slippedCount: number;
  soonCount: number;
  deadlineCount: number;
  /** 0 when nothing needs attention, approaching 1 as pressure stacks up. */
  score: number;
  level: UrgencyLevel;
};

/** School Blocks and commitments are materialized per day and never
 *  "completed", so they can't meaningfully be overdue. Canvas imports reuse
 *  kind "school" but are real assignments, so they still count. */
export function tracksCompletion(task: Task): boolean {
  if (task.source === "canvas") return true;
  return task.kind !== "school" && task.kind !== "commitment";
}

function minutesOfDay(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00`).getTime();
  const b = new Date(`${toYmd}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function classify(task: Task, now: Date, today: string, nowMinutes: number): AttentionItem | null {
  if (task.date < today) {
    const daysLate = daysBetween(task.date, today);
    return { task, reason: { type: "overdue", daysLate }, weight: Math.min(1, 0.7 + daysLate * 0.05) };
  }

  const start = minutesOfDay(task.time);

  if (task.date === today && start !== null) {
    if (start < nowMinutes) {
      return { task, reason: { type: "slipped", minutesLate: nowMinutes - start }, weight: 0.55 };
    }
    const minutesUntil = start - nowMinutes;
    if (minutesUntil <= SOON_WINDOW_MINUTES) {
      return {
        task,
        reason: { type: "soon", minutesUntil },
        weight: 0.2 + 0.3 * (1 - minutesUntil / SOON_WINDOW_MINUTES),
      };
    }
  }

  if (task.source === "canvas") {
    const due = new Date(`${task.date}T${start !== null ? task.time : "23:59"}:00`);
    const hoursUntil = (due.getTime() - now.getTime()) / 3_600_000;
    if (hoursUntil >= 0 && hoursUntil <= CANVAS_DEADLINE_WINDOW_HOURS) {
      return {
        task,
        reason: { type: "deadline", hoursUntil: Math.round(hoursUntil) },
        weight: 0.25 + 0.3 * (1 - hoursUntil / CANVAS_DEADLINE_WINDOW_HOURS),
      };
    }
  }

  return null;
}

const REASON_ORDER: Record<AttentionReason["type"], number> = { overdue: 0, slipped: 1, soon: 2, deadline: 3 };

export function getUrgency(tasks: Task[], now: Date = new Date()): UrgencySummary {
  const today = toYMD(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const items = tasks
    .filter((task) => !task.completed && tracksCompletion(task))
    .map((task) => classify(task, now, today, nowMinutes))
    .filter((item): item is AttentionItem => item !== null)
    .sort((a, b) => {
      const byReason = REASON_ORDER[a.reason.type] - REASON_ORDER[b.reason.type];
      if (byReason !== 0) return byReason;
      return a.task.date === b.task.date ? a.task.time.localeCompare(b.task.time) : a.task.date.localeCompare(b.task.date);
    });

  // Saturating curve: one overdue item reads as "elevated", a pile-up
  // approaches 1 without any single item maxing the scale on its own.
  const pressure = items.reduce((sum, item) => sum + item.weight, 0);
  const score = items.length === 0 ? 0 : 1 - Math.exp(-pressure / 1.6);

  const level: UrgencyLevel =
    items.length === 0 ? "clear" : score < 0.3 ? "low" : score < 0.65 ? "elevated" : "high";

  return {
    items,
    overdueCount: items.filter((i) => i.reason.type === "overdue").length,
    slippedCount: items.filter((i) => i.reason.type === "slipped").length,
    soonCount: items.filter((i) => i.reason.type === "soon").length,
    deadlineCount: items.filter((i) => i.reason.type === "deadline").length,
    score,
    level,
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr`;
}

export function describeReason(reason: AttentionReason): string {
  switch (reason.type) {
    case "overdue":
      return reason.daysLate === 1 ? "Yesterday" : `${reason.daysLate} days late`;
    case "slipped":
      return `${formatDuration(reason.minutesLate)} ago`;
    case "soon":
      return reason.minutesUntil <= 1 ? "Starting now" : `In ${formatDuration(reason.minutesUntil)}`;
    case "deadline":
      return reason.hoursUntil < 1 ? "Due within the hour" : `Due in ${reason.hoursUntil} hr`;
  }
}
