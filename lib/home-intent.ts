// Hand-off from the app shell to the Home composer: the sidebar's "New"
// button focuses it, the phone mic button starts listening in it. The intent
// waits in sessionStorage so it survives the route change to "/", and an event
// tells a composer that's already on screen. Whoever takes it first clears it,
// and one nobody took within a few seconds is dropped, so a later visit to
// Home never starts listening out of the blue.

export type HomeIntent = "focus" | "listen";

export const HOME_INTENT_EVENT = "tangent:home-intent";
const KEY = "tangent:home-intent";
const FRESH_MS = 10_000;

export function requestHomeIntent(intent: HomeIntent) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ intent, at: Date.now() }));
  } catch {
    // Storage blocked: nothing to hand over.
  }
  window.dispatchEvent(new Event(HOME_INTENT_EVENT));
}

export function takeHomeIntent(now = Date.now()): HomeIntent | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { intent?: unknown; at?: unknown };
    if (typeof saved.at !== "number" || now - saved.at > FRESH_MS) return null;
    return saved.intent === "focus" || saved.intent === "listen" ? saved.intent : null;
  } catch {
    return null;
  }
}

// Round 4 §3.1: a goal to plan in place on Home (onboarding's "Anything you
// want to make progress on?", or the starting-point card). Unlike focus and
// listen it waits until Home's composer takes it: the student may still be in
// the get-to-know conversation when it's handed over. Their own words, so
// sessionStorage, never the URL.
const PLAN_KEY = "tangent:home-plan";

export type HomePlan = { goal: string; fromOnboarding: boolean };

export function requestHomePlan(goal: string, fromOnboarding = false) {
  const g = goal.trim();
  if (!g) return;
  try {
    window.sessionStorage.setItem(PLAN_KEY, JSON.stringify({ goal: g.slice(0, 300), fromOnboarding }));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(HOME_INTENT_EVENT));
}

export function takeHomePlan(): HomePlan | null {
  try {
    const raw = window.sessionStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PLAN_KEY);
    const saved = JSON.parse(raw) as { goal?: unknown; fromOnboarding?: unknown };
    return typeof saved.goal === "string" && saved.goal.trim() ? { goal: saved.goal.trim(), fromOnboarding: saved.fromOnboarding === true } : null;
  } catch {
    return null;
  }
}

/** The words Home's composer sends for a handed-over goal: always read as
 *  planning (lib/pipeline/planning-intent.ts), never a task. */
export function planRequestFor(goal: string): string {
  return `Break down plan: ${goal.trim()}`;
}
