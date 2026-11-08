// The plan preview's mini week: seven columns, Monday to Sunday, from 7:00 to
// 23:00. New tasks come from the ChangeSet's ops; what's already on the
// calendar sits behind them, with School Blocks fainter still. Anything
// outside the hours is pressed against the edge rather than dropped. Pure.

import { formatTime12, isDueOnly } from "./dates";
import { startOfPreviewWeek, weekLabel, type MonthGridItem, type WeekStart } from "./month-grid";
import type { ChangeSet } from "./pipeline/changeset";
import { schoolEndFromNotes } from "./schedule-slots";
import { isOnboardingSchoolTask } from "./school-block";
import { commitmentLabel } from "./task-kind";
import { assignProjectColor, planSeriesColor, seriesColor, taskSeries } from "./task-colors";
import { addDaysYMD } from "./time";
import type { Plan, Task } from "./types";

export const DAY_START = 7 * 60;
export const DAY_END = 23 * 60;
/** Every other block on the calendar is drawn at this length. */
const BLOCK_MINUTES = 45;
const MIN_HEIGHT_PCT = 4;
/** A series with no end shows this many weeks; none shows past the cap. */
const REPEAT_WEEKS = 4;
const MAX_WEEKS = 26;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WeekBlock = {
  key: string;
  kind: "new" | "existing" | "school";
  title: string;
  /** 0 is Monday. */
  dayIndex: number;
  /** Null: no time, so it sits in the strip above the hours. */
  topPct: number | null;
  heightPct: number;
  color: string | null;
  when: string;
  why: string | null;
  label?: string;
};

export type PreviewWeek = { start: string; label: string; days: { ymd: string; label: string }[]; blocks: WeekBlock[] };

type Op = ChangeSet["ops"][number];

const parts = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function mondayOf(ymd: string): string {
  const weekday = parts(ymd).getUTCDay();
  return addDaysYMD(ymd, weekday === 0 ? -6 : 1 - weekday);
}

const shortDate = (ymd: string) => `${MONTHS[parts(ymd).getUTCMonth()]} ${parts(ymd).getUTCDate()}`;
const dayLabel = (ymd: string) => `${WEEKDAYS[parts(ymd).getUTCDay()]}, ${shortDate(ymd)}`;
const toMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Where a block sits in the column, as percentages, inside the waking hours. */
export function placeInDay(startMin: number, endMin: number): { topPct: number; heightPct: number } {
  const span = DAY_END - DAY_START;
  const start = Math.min(DAY_END, Math.max(DAY_START, startMin));
  const end = Math.min(DAY_END, Math.max(DAY_START, endMin));
  const heightPct = Math.max(MIN_HEIGHT_PCT, ((end - start) / span) * 100);
  return { topPct: Math.min(100 - heightPct, ((start - DAY_START) / span) * 100), heightPct };
}

/** One line on why this step is here, from what the planner wrote on it. */
export function whyLine(notes?: string | null, startAction?: string | null): string | null {
  const text = (notes ?? "").replace(/^\s*GOAL:\s*/i, "").split(/\bTIME:|\n/i)[0].trim();
  const line = (text.split(/(?<=[.!?])\s/)[0] || startAction || "").trim();
  if (!line) return null;
  return line.length > 90 ? `${line.slice(0, 89).trimEnd()}…` : line;
}

/** Every date a task op lands on: its own, plus a series' repeats. */
export function opDates(op: Extract<Op, { op: "add_task" }>): string[] {
  const repeat = op.repeat;
  if (!repeat || repeat.frequency === "monthly" || repeat.frequency === "yearly") return [op.date];
  const cap = addDaysYMD(op.date, REPEAT_WEEKS * 7 - 1);
  const last = repeat.endDate && repeat.endDate < addDaysYMD(op.date, MAX_WEEKS * 7) ? repeat.endDate : cap;
  const days = repeat.frequency === "weekly" ? repeat.daysOfWeek ?? [parts(op.date).getUTCDay()] : [0, 1, 2, 3, 4, 5, 6];
  const out: string[] = [];
  for (let d = op.date; d <= last; d = addDaysYMD(d, 1)) if (days.includes(parts(d).getUTCDay())) out.push(d);
  return out.length > 0 ? out : [op.date];
}

type Placed = Omit<WeekBlock, "dayIndex"> & { date: string };
type PlanColors = readonly Pick<Plan, "id" | "color">[];

/** A new step's color: its project's, or the one its new project is about to get. */
function addedColor(op: Extract<Op, { op: "add_task" }>, plans: PlanColors): string {
  if (op.plan_id) return planSeriesColor({ id: op.plan_id, color: plans.find((p) => p.id === op.plan_id)?.color ?? "" });
  if (op.plan_ref) return seriesColor(assignProjectColor(plans.map((p) => p.color)));
  return seriesColor(op.commitment === "fixed" || op.commitment === "reminder" ? "personal" : "neutral");
}

function newBlocks(ops: Op[], tasks: Task[], plans: PlanColors): Placed[] {
  const out: Placed[] = [];
  ops.forEach((op, i) => {
    if (op.op === "add_task") {
      for (const date of opDates(op)) {
        const place = op.time ? placeInDay(toMinutes(op.time), toMinutes(op.time) + BLOCK_MINUTES) : { topPct: null, heightPct: 0 };
        out.push({
          key: `new-${i}-${date}`,
          kind: "new",
          title: op.title,
          date,
          ...place,
          color: addedColor(op, plans),
          when: `${dayLabel(date)} · ${op.time ? formatTime12(op.time) : "Anytime"}`,
          why: whyLine(op.notes, op.startAction),
          label: op.commitment ? commitmentLabel(op.commitment) : undefined,
        });
      }
    } else if (op.op === "move_task") {
      const task = tasks.find((t) => t.id === op.task_id);
      const time = op.time ?? task?.time ?? "";
      const place = time ? placeInDay(toMinutes(time), toMinutes(time) + BLOCK_MINUTES) : { topPct: null, heightPct: 0 };
      out.push({
        key: `new-${i}-${op.date}`,
        kind: "new",
        title: task?.title ?? "Moved task",
        date: op.date,
        ...place,
        color: task ? seriesColor(taskSeries(task, plans)) : "var(--accent)",
        when: time ? `${dayLabel(op.date)} · ${formatTime12(time)}` : dayLabel(op.date),
        why: task ? whyLine(task.notes, task.startAction) : null,
      });
    }
  });
  return out;
}

function calendarBlocks(tasks: Task[], ops: Op[]): Placed[] {
  const moved = new Set(ops.flatMap((o) => (o.op === "move_task" ? [o.task_id] : [])));
  const out: Placed[] = [];
  for (const task of tasks) {
    if (task.completed || !task.date || !task.time || isDueOnly(task) || moved.has(task.id)) continue;
    const school = isOnboardingSchoolTask(task);
    const start = toMinutes(task.time);
    const end = school ? schoolEndFromNotes(task.notes) ?? start + BLOCK_MINUTES : start + BLOCK_MINUTES;
    out.push({
      key: `${school ? "school" : "task"}-${task.id}`,
      kind: school ? "school" : "existing",
      title: task.title,
      date: task.date,
      ...placeInDay(start, end),
      color: null,
      when: `${dayLabel(task.date)} · ${formatTime12(task.time)}`,
      why: null,
    });
  }
  return out;
}

export function previewMonthItems(ops: Op[], tasks: Task[], plans: PlanColors): MonthGridItem[] {
  const moved = new Set(ops.flatMap((op) => op.op === "move_task" ? [op.task_id] : []));
  const fresh = newBlocks(ops, tasks, plans).map(({ key, date, title, when, why, color, label }): MonthGridItem => ({
    key, date, title, kind: "new", when, why: why ?? undefined, color: color ?? undefined, label,
  }));
  const existing = tasks.filter((task) => !task.completed && task.date && !moved.has(task.id)).map((task): MonthGridItem => ({
    key: task.id,
    date: task.date,
    title: task.title,
    kind: "existing",
    when: `${dayLabel(task.date)} · ${task.time && !isDueOnly(task) ? formatTime12(task.time) : "Anytime"}`,
  }));
  return [...fresh, ...existing];
}

/** The weeks the change touches, in order and with no gaps. The first holds
 *  the first new task, so that's where the preview opens. */
export function previewWeeks(ops: Op[], tasks: Task[], plans: PlanColors = [], selected?: { date: string; weekStart: WeekStart }): PreviewWeek[] {
  const fresh = newBlocks(ops, tasks, plans);
  if (fresh.length === 0) return [];
  const dates = fresh.map((b) => b.date).sort();
  const first = selected ? startOfPreviewWeek(selected.date, selected.weekStart) : mondayOf(dates[0]);
  const lastStart = selected ? first : mondayOf(dates[dates.length - 1]);
  const others = calendarBlocks(tasks, ops);
  const weeks: PreviewWeek[] = [];
  for (let start = first; start <= lastStart && weeks.length < MAX_WEEKS; start = addDaysYMD(start, 7)) {
    const end = addDaysYMD(start, 6);
    const dayIndex = (date: string) => (parts(date).getTime() - parts(start).getTime()) / 86_400_000;
    const inWeek = (b: Placed) => b.date >= start && b.date <= end;
    weeks.push({
      start,
      label: selected ? weekLabel(start) : `${shortDate(start)} – ${shortDate(end)}`,
      days: Array.from({ length: 7 }, (_, i) => {
        const ymd = addDaysYMD(start, i);
        return { ymd, label: WEEKDAYS[parts(ymd).getUTCDay()] };
      }),
      // Calendar first, so new work paints on top.
      blocks: [...others.filter(inWeek), ...fresh.filter(inWeek)].map(({ date, ...b }) => ({ ...b, dayIndex: dayIndex(date) })),
    });
  }
  return weeks;
}
