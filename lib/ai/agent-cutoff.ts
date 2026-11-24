// Overnight 2 (Priya sim): the agent's third turn wrote a long create_plan call,
// hit its 2,048-token cap mid tool call (stop_reason "max_tokens"), and the
// loop returned the half-finished narration ("The task list was cut off, so
// I'll check…") as the reply. Nothing was drafted, and the student saw no error.
//
// Now: a cut-off turn is retried once with a bigger cap while there's still time
// inside the route's 60 s limit; otherwise the student hears plainly that
// nothing was added.

/** The retry's output cap: about twice what an 8-session plan needs. */
export const AGENT_RETRY_MAX_TOKENS = 4096;

/** Only retry if the loop has used less than this; a 4,096-token Sonnet turn
 *  takes up to ~35 s, and /api/voice and /api/chat stop at 60 s. */
export const AGENT_RETRY_BUDGET_MS = 25_000;

export const AGENT_CUTOFF_REPLY = "That plan got too long to finish, so nothing was added. Try asking for just the first week of it.";

export type CutoffDecision = "ok" | "retry" | "give_up";

export function afterAgentTurn(stopReason: string | null | undefined, alreadyRetried: boolean, elapsedMs: number): CutoffDecision {
  if (stopReason !== "max_tokens") return "ok";
  if (!alreadyRetried && elapsedMs < AGENT_RETRY_BUDGET_MS) return "retry";
  return "give_up";
}

/** A tool result cut to fit, ending on a note the model can act on, instead of
 *  JSON broken mid-string. */
export function fitToolResult(json: string, limit = 8000): string {
  if (json.length <= limit) return json;
  const note = ' …[cut to fit: ask for a narrower date range or filter to see the rest]';
  return json.slice(0, limit - note.length) + note;
}
