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
