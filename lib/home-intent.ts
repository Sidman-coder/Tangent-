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
