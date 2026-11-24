// Overnight 2 (eval push-icf-back): "push my ICF checkpoints back two days"
// is plain arithmetic, so it never needs the model. extendPlan only adds or
// renames; this turns a whole-plan shift into move_task ops for a preview.

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, "a couple": 2, "a couple of": 2 };
const AMOUNT = String.raw`(\d{1,2}|a couple(?: of)?|an?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?)`;
const VERB = String.raw`^(?:can you\s+|please\s+)?(push|move|shift|bump|delay|postpone)\b`;

/** Days to move a plan by (later is positive), or null when the text isn't a
 *  clear "push/move … back/forward N days|weeks". */
export function parsePlanShift(text: string): number | null {
  const s = text.toLowerCase().replace(/[.!?]+$/, "").trim();
  const verb = s.match(new RegExp(VERB));
  if (!verb) return null;
  const amount = s.match(new RegExp(String.raw`\b(?:by\s+)?${AMOUNT}\b`));
  if (!amount) return null;
  const n = /^\d+$/.test(amount[1]) ? Number(amount[1]) : NUM[amount[1]];
  const days = n * (amount[2].startsWith("week") ? 7 : 1);
  if (!days || days > 60) return null;
  const earlier = /\b(forward|earlier|up|sooner)\b/.test(s);
  const later = /\b(back|later)\b/.test(s) || verb[1] === "delay" || verb[1] === "postpone";
  if (earlier === later) return null;
  return earlier ? -days : days;
}

type ShiftTask = { id: string; date: string; time?: string; completed?: boolean };
export type MoveOp = { op: "move_task"; task_id: string; date: string; time?: string };

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** move_task ops for the plan's open steps from today on; nothing lands before today. */
export function planShiftOps(tasks: readonly ShiftTask[], days: number, today: string): MoveOp[] {
  return tasks
    .filter((t) => !t.completed && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const moved = addDays(t.date, days);
      const date = moved < today ? today : moved;
      return t.time ? { op: "move_task" as const, task_id: t.id, date, time: t.time } : { op: "move_task" as const, task_id: t.id, date };
    });
}
