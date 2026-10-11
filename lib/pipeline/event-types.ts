// Pipeline V2 event vocabulary and the props sanitizer used by logEvent
// (lib/pipeline/events.ts). Pure, so it can be unit tested with plain Node.
//
// Events hold small structured facts only, never anything a student wrote:
// prop values are numbers, booleans, null, or short machine tokens such as
// "voice", "add_task" or "fast:complete". Anything else is dropped.

export const EVENT_TYPES = [
  "request_received",
  "changeset_drafted",
  "preview_shown",
  "changeset_confirmed",
  "changeset_discarded",
  "changeset_undone",
  "preview_edited",
  // Step 3: understanding (lib/pipeline/intent.ts, match.ts, lib/pending-question.ts).
  // The events table checks only the name's shape (^[a-z_]{1,64}$), so new
  // types need no migration.
  "intent_classified",
  "match_proposed",
  "match_confirmed",
  "match_corrected",
  "clarify_shown",
  "clarify_answered",
  "pending_question_resolved",
  // Step 3B: Settings › AI Activity (lib/pipeline/activity.ts).
  "activity_viewed",
  "activity_row_expanded",
  "activity_cleared",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventPropValue = number | boolean | string | null;
export type EventProps = Record<string, EventPropValue>;

const MAX_PROPS = 16;
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
/** A token, not a sentence: no spaces, no punctuation beyond _ : . - */
const TOKEN_RE = /^[a-z0-9_:.-]{0,64}$/i;

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

/** Keeps only safe keys and values; never throws. */
export function sanitizeEventProps(props: unknown): EventProps {
  const out: EventProps = {};
  if (!props || typeof props !== "object" || Array.isArray(props)) return out;
  let kept = 0;
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (kept >= MAX_PROPS) break;
    if (!KEY_RE.test(key)) continue;
    const ok =
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && TOKEN_RE.test(value));
    if (!ok) continue;
    out[key] = value as EventPropValue;
    kept++;
  }
  return out;
}
