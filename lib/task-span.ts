// Round 5A Phase 4.3 (R3): a task can last longer than the default block and
// can run across several days. Pure, so the calendar, the API and the add form
// share one set of rules.
//
// - `durationMin`: how long the block is on each day it covers. Null means the
//   default calendar block (45 min).
// - `endDate`: the last day a range task covers. Null (or equal to `date`)
//   means a single-date task.

export const DEFAULT_BLOCK_MIN = 45;
export const MIN_DURATION_MIN = 15;
export const MAX_DURATION_MIN = 24 * 60;
/** A range can't run longer than this, so a stray drag can't paint a whole year. */
export const MAX_SPAN_DAYS = 62;
const SNAP_MIN = 15;

export type SpanFields = { date: string; endDate?: string | null; durationMin?: number | null };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(ymd: string, n: number): string {
  return new Date(ymdToUtc(ymd) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function dayDiff(a: string, b: string): number {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / 86_400_000);
}

/** The last day the task covers: its end date when that's after its date. */
export function spanEnd(task: SpanFields): string {
  return task.endDate && YMD.test(task.endDate) && task.endDate > task.date ? task.endDate : task.date;
}

export function isMultiDay(task: SpanFields): boolean {
  return spanEnd(task) !== task.date;
}

export function coversDay(task: SpanFields, ymd: string): boolean {
  return task.date <= ymd && ymd <= spanEnd(task);
}

/** Every day the task covers, first to last. */
export function spanDates(task: SpanFields): string[] {
  const days = Math.min(dayDiff(task.date, spanEnd(task)), MAX_SPAN_DAYS);
  return Array.from({ length: days + 1 }, (_, i) => addDays(task.date, i));
}

/** Minutes the block takes on the calendar. */
export function blockMinutes(task: { durationMin?: number | null }): number {
  const d = task.durationMin;
  return typeof d === "number" && Number.isFinite(d) && d >= MIN_DURATION_MIN ? Math.min(d, MAX_DURATION_MIN) : DEFAULT_BLOCK_MIN;
}

function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

/**
 * Where a drag of the block's bottom edge lands.
 * - Same day: the block's length follows the pointer (15-min steps, at least
 *   15 min, never past midnight). The task stays single-date.
 * - A later day column: the task now runs through that day. The length follows
 *   the pointer's time on that day when it's after the start time; otherwise
 *   the current length is kept.
 * - An earlier column counts as the start day.
 */
export function resizeTarget(args: {
  date: string;
  startMin: number;
  currentDurationMin: number;
  pointerYmd: string;
  pointerMin: number;
}): { durationMin: number; endDate: string | null } {
  const { date, startMin, currentDurationMin, pointerYmd, pointerMin } = args;
  const maxToday = Math.max(MIN_DURATION_MIN, 24 * 60 - startMin);
  const fit = (min: number) => Math.min(maxToday, Math.max(MIN_DURATION_MIN, snap(min)));
  if (pointerYmd > date) {
    const endDate = dayDiff(date, pointerYmd) > MAX_SPAN_DAYS ? addDays(date, MAX_SPAN_DAYS) : pointerYmd;
    const length = pointerMin > startMin ? fit(pointerMin - startMin) : fit(currentDurationMin);
    return { durationMin: length, endDate };
  }
  return { durationMin: fit(pointerMin - startMin), endDate: null };
}

/** Moving a range task keeps its length in days: the end date shifts with it. */
export function shiftedEndDate(task: SpanFields, newDate: string): string | null {
  if (!isMultiDay(task)) return null;
  return addDays(spanEnd(task), dayDiff(task.date, newDate));
}

/** Request checks for the two fields. Null when fine. */
export function spanFieldError(fields: { date?: string; endDate?: unknown; durationMin?: unknown }): string | null {
  const { endDate, durationMin } = fields;
  if (endDate !== undefined && endDate !== null) {
    if (typeof endDate !== "string" || !YMD.test(endDate)) return "endDate must be YYYY-MM-DD";
    if (fields.date && endDate < fields.date) return "The end date can't be before the start date.";
    if (fields.date && dayDiff(fields.date, endDate) > MAX_SPAN_DAYS) return `A task can run for at most ${MAX_SPAN_DAYS + 1} days.`;
  }
  if (durationMin !== undefined && durationMin !== null) {
    if (typeof durationMin !== "number" || !Number.isInteger(durationMin)) return "durationMin must be whole minutes";
    if (durationMin < MIN_DURATION_MIN || durationMin > MAX_DURATION_MIN) {
      return `durationMin must be between ${MIN_DURATION_MIN} and ${MAX_DURATION_MIN}`;
    }
  }
  return null;
}

/** "45 min", "1 hr", "1 hr 30 min". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
