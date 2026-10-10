// Pipeline V2 intake: which way one message goes, now that there is one box
// instead of the Plan/Calendar switch (used by lib/pipeline/intake.ts).
//
//   "fast"  a no-AI fast path (lib/ai/router.ts) acts now; the receipt has Undo.
//   "chat"  a clear question or brainstorm with no action words: a chat reply,
//           no ChangeSet.
//   "draft" anything that would create or change tasks or plans, and anything
//           unclear: drafted and shown as a preview card.
//
// TODO(Pipeline V2 Prompt 3): this keyword rule is temporary. Prompt 3 replaces
// it with the model's own intent; keep the "fast" | "chat" | "draft" result.
//
// Pure (no store, no AI) so it can be unit tested with plain Node.

import { routeCommand } from "../ai/router";

export type RequestRoute = "fast" | "chat" | "draft";

// Spoken filler at the start: "um so can you…", "uh what should i…".
const FILLER = /^(?:(?:um+|uh+|erm+|hmm+|like|so|ok(?:ay)?|hey|hi|tangent|well|yeah)\b[\s,]*)+/i;

// Words that ask for a change. "plan" and "schedule" count only as verbs:
// "help me plan", "should I schedule" act; "my plan", "the schedule" don't.
const ACTION_WORDS =
  /\b(?:add|put|move|reschedule|create|remind|make|book|cancel|delete|remove|clear|push|shift|block|set up|mark|done with|finished|complete|sign me up)\b/i;
const PLAN_VERB = /(?<!\b(?:my|the|a|an|your|this|that|our|his|her|their|today's|tomorrow's|week's)\s)\b(?:plan|schedule)\b/i;

// A clear question or brainstorm, before any action-word check.
const QUESTION_OPENER =
  /^(?:what|what's|whats|how|why|when|where|which|who|whose|should|would|could|can|is|are|am|do|does|did|was|were|will|any|tell me|explain)\b/i;
const BRAINSTORM_OPENER =
  /^(?:ideas?\b|brainstorm|help me think|let'?s think|thoughts on|thinking about|talk me through|what if|i'?m thinking|i'?m wondering|i wonder)/i;

/** The message with leading filler and spare whitespace removed, lowercase. */
export function normalizeRequest(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(FILLER, "").trim().toLowerCase();
}

/** True when the message asks for a change somewhere in it. */
export function hasActionWords(text: string): boolean {
  const s = normalizeRequest(text);
  return ACTION_WORDS.test(s) || PLAN_VERB.test(s);
}

/** Where one message goes. When unsure: "draft". */
export function routeRequest(text: string, tz: string, at?: Date): RequestRoute {
  if (routeCommand(text, tz, at)) return "fast";
  const s = normalizeRequest(text);
  if (!s) return "draft";
  const asks = s.endsWith("?") || QUESTION_OPENER.test(s) || BRAINSTORM_OPENER.test(s);
  if (asks && !hasActionWords(s)) return "chat";
  return "draft";
}
