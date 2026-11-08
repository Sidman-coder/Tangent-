// What Today remembers on this device for one day: the steps set aside with
// Not today (their dates are facts, so nothing changes on the server) and that
// the automatic re-plan already ran. Losing either is harmless.

const ASIDE_KEY = "tangent-today-aside";
const REPLAN_KEY = "tangent-today-replan";
/** Fired after Not today changes the set, so the sidebar's Home count follows. */
export const SET_ASIDE_EVENT = "tangent:today-aside";

export function readSetAside(today: string): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(ASIDE_KEY) ?? "null") as { day?: string; ids?: unknown } | null;
    if (saved?.day === today && Array.isArray(saved.ids)) {
      return new Set(saved.ids.filter((id): id is string => typeof id === "string"));
    }
  } catch {
    /* storage blocked or the value is stale */
  }
  return new Set();
}

export function writeSetAside(today: string, ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(ASIDE_KEY, JSON.stringify({ day: today, ids: Array.from(ids) }));
  } catch {
    /* storage blocked: it lasts until the page reloads */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SET_ASIDE_EVENT));
}

export function readReplanDay(): string | null {
  try {
    return localStorage.getItem(REPLAN_KEY);
  } catch {
    return null;
  }
}

export function writeReplanDay(today: string): void {
  try {
    localStorage.setItem(REPLAN_KEY, today);
  } catch {
    /* storage blocked: it may run again on the next load */
  }
}

// Round 4 §3.4: how many times each step was put off with Not today, so the
// second time asks why (one tap). Device-only; losing it just asks later.
const PUT_OFF_KEY = "tangent-today-put-off";

/** Counts this Not today and returns the step's total so far. */
export function bumpPutOff(taskId: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(PUT_OFF_KEY) ?? "{}") as Record<string, unknown>;
    const counts: Record<string, number> = {};
    for (const [id, n] of Object.entries(saved)) if (typeof n === "number") counts[id] = n;
    const next = (counts[taskId] ?? 0) + 1;
    counts[taskId] = next;
    // Keep the newest 200 steps.
    const kept = Object.fromEntries(Object.entries(counts).slice(-200));
    localStorage.setItem(PUT_OFF_KEY, JSON.stringify(kept));
    return next;
  } catch {
    return 1;
  }
}
