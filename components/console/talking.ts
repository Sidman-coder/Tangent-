// Pipeline V2 (A4): after "Just talking, don't add" the console keeps talking
// the plan through, one question at a time, instead of drafting each reply.
// When the latest reply is a complete schedule it asks "Ready to add this to
// your calendar?", and an "Add plan to calendar" chip stays until that plan is
// added or discarded. Pure, so the flow is unit tested (talking.test.ts).
//
// Builds on what exists: the intake's route "chat" (lib/pipeline/intake.ts)
// answers with Juann's Plan prompt and marks a complete schedule "plan_reply";
// the action-word rule (route-request.ts) and "add this plan" (plan-text.ts)
// decide when the student is asking to act instead.

import { hasActionWords } from "@/lib/pipeline/route-request";
import { isAddShownPlan } from "@/lib/pipeline/plan-text";

/** The turn fields this reads; see components/console/turns.ts. */
export type TalkTurn = {
  id: string;
  /** This turn was answered by "Just talking", or followed one. */
  talking?: boolean;
  /** The reply is a complete schedule that can be added. */
  planReady?: boolean;
  /** That schedule was drafted into a preview or dismissed. */
  planClosed?: boolean;
};

/**
 * The route for the next message: "chat" while the conversation is talking
 * (the last turn is), unless the message asks to act ("add soccer tomorrow",
 * "add this plan"), which goes through the intake as usual.
 */
export function talkingRoute(turns: readonly TalkTurn[], text: string): "chat" | undefined {
  const last = turns[turns.length - 1];
  if (!last?.talking) return undefined;
  if (isAddShownPlan(text) || hasActionWords(text)) return undefined;
  return "chat";
}

/** A talked-through reply that is a finished schedule ("plan_reply" from the
 *  intake, not ending on a question): show "Ready to add this?". */
export function isReadyReply(action: string | null | undefined, reply: string): boolean {
  return action === "plan_reply" && !/\?\s*$/.test(reply.trim());
}

/** The turn the "Add plan to calendar" chip adds: the newest complete
 *  schedule not yet added or dismissed. */
export function openPlanTurn<T extends TalkTurn>(turns: readonly T[]): T | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.planReady) return t.planClosed ? null : t;
  }
  return null;
}
