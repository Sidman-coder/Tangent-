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
  /** A capture finished. `seq` is the send it belongs to; a late one from an earlier capture is ignored. */
  | { type: "sorted"; seq: number };

export type HoldEffect = "none" | "start-listening" | "open-typing" | "send" | "abort";

/** `seq` counts sends, so each capture's result can be matched to its own send. */
export type Hold = { state: HoldState; downT: number; downY: number; seq: number };

export const initialHold: Hold = { state: "idle", downT: 0, downY: 0, seq: 0 };

/** Listening that began without a press (the ?capture=1 shortcut): the next tap sends. */
export const listeningWithoutPress: Hold = { state: "listening", downT: -1, downY: 0, seq: 0 };

export function holdReducer(s: Hold, e: HoldEvent): { next: Hold; effect: HoldEffect } {
  const stay = { next: s, effect: "none" as const };
  const idle = (effect: HoldEffect) => ({ next: { ...initialHold, seq: s.seq }, effect });

  switch (s.state) {
    case "sorting":
      return e.type === "sorted" && e.seq === s.seq ? idle("none") : stay;
    case "idle":
      return e.type === "down" ? { next: { ...s, state: "pressed", downT: e.t, downY: e.y }, effect: "none" } : stay;
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
        return { next: { ...s, state: "sorting", seq: s.seq + 1 }, effect: "send" };
      }
      if (e.type === "cancel") return idle("abort");
      return stay;
  }
}

/** What Space landed on. Space belongs to the focused control (a check, a chip,
 *  a link) unless nothing interactive has focus, or the island itself does. */
export type SpaceTarget = { tagName?: string; role?: string | null; isContentEditable?: boolean; isIsland?: boolean } | null;

export function spaceStartsHold(target: SpaceTarget): boolean {
  if (!target || target.isIsland) return true;
  if (target.isContentEditable) return false;
  if (["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT", "SUMMARY"].includes(target.tagName ?? "")) return false;
  return target.role !== "button" && target.role !== "link" && target.role !== "checkbox";
}
