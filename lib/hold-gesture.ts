// The capture island's press, as a pure state machine so every way a press
// can end is tested: a quick tap types, a hold listens, letting go sends,
// dragging up (or the browser taking the pointer away) cancels, and nothing
// can start while the last capture is still being sorted.

export const HOLD_MS = 200;
export const CANCEL_DRAG_PX = 40;

export type HoldState = "idle" | "pressed" | "listening" | "sorting";

export type HoldEvent =
  | { type: "down"; t: number; y: number }
  | { type: "tick"; t: number }
  | { type: "up"; t: number; y: number }
  | { type: "cancel" }
  | { type: "sorted" };

export type HoldEffect = "none" | "start-listening" | "open-typing" | "send" | "abort";

export type Hold = { state: HoldState; downT: number; downY: number };

export const initialHold: Hold = { state: "idle", downT: 0, downY: 0 };

/** Listening that began without a press (the ?capture=1 shortcut): the next tap sends. */
export const listeningWithoutPress: Hold = { state: "listening", downT: -1, downY: 0 };

export function holdReducer(s: Hold, e: HoldEvent): { next: Hold; effect: HoldEffect } {
  const stay = { next: s, effect: "none" as const };
  const idle = (effect: HoldEffect) => ({ next: initialHold, effect });

  switch (s.state) {
    case "sorting":
      return e.type === "sorted" ? idle("none") : stay;
    case "idle":
      return e.type === "down" ? { next: { state: "pressed", downT: e.t, downY: e.y }, effect: "none" } : stay;
    case "pressed":
      if (e.type === "tick" && e.t - s.downT >= HOLD_MS) return { next: { ...s, state: "listening" }, effect: "start-listening" };
      if (e.type === "up") return idle("open-typing");
      if (e.type === "cancel") return idle("abort");
      return stay;
    case "listening":
      // Tap-to-stop: the press that will end it lands while already listening.
      if (e.type === "down") return { next: { ...s, downY: e.y }, effect: "none" };
      if (e.type === "up") {
        if (s.downY - e.y > CANCEL_DRAG_PX) return idle("abort");
        return { next: { ...s, state: "sorting" }, effect: "send" };
      }
      if (e.type === "cancel") return idle("abort");
      return stay;
  }
}
