// Checks the fields /api/tasks passes to the database (Round 4, Phase 1.1).
// A value Postgres would reject (an empty or impossible date, a time that
// isn't HH:MM, a title that isn't text) used to reach the insert and come back
// as a 500. Rejecting it here gives the client a 400 it can act on.

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
// Seconds are allowed (some <input type="time"> values carry them) and dropped.
const HM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** A real calendar date written YYYY-MM-DD. */
export function isValidYmd(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = YMD.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "HH:MM" (24-hour), or "" for a task with no time. */
export function isValidTime(value: unknown): value is string {
  return value === "" || (typeof value === "string" && HM.test(value));
}

/** A valid time as stored: "HH:MM" or "". */
export function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

type TaskFields = {
  title?: unknown;
  date?: unknown;
  time?: unknown;
  completed?: unknown;
  notes?: unknown;
  endDate?: unknown;
};

/** The first problem with the fields that are present, or null. `undefined`
 *  means "not sent" and is always fine; `null` is fine for time (no time). */
export function taskFieldError(body: TaskFields): string | null {
  if (body.title !== undefined && (typeof body.title !== "string" || body.title.length > 500)) {
    return "title must be text";
  }
  if (body.date !== undefined && !isValidYmd(body.date)) return "date must be YYYY-MM-DD";
  if (body.time !== undefined && body.time !== null && !isValidTime(body.time)) return "time must be HH:MM";
  if (body.completed !== undefined && typeof body.completed !== "boolean") return "completed must be true or false";
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") return "notes must be text";
  if (body.endDate !== undefined && body.endDate !== null && !isValidYmd(body.endDate)) return "endDate must be YYYY-MM-DD";
  return null;
}
