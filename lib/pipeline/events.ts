import "server-only";
import { getRequestContext, trackPending } from "../request-context";
import { isEventType, sanitizeEventProps, type EventProps, type EventType } from "./event-types";

export { EVENT_TYPES, type EventType, type EventProps } from "./event-types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOrNull = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);

export type EventRefs = { changeSetId?: string | null; planId?: string | null; taskId?: string | null };

/**
 * Records one Pipeline V2 event for the student in the current request.
 * Returns immediately and never throws. The insert is tracked on the request
 * (trackPending), so withUser waits for it, at most 1.5 s, before the response
 * goes out and it is not lost when a serverless function freezes. A failed
 * insert is logged and dropped. Props are sanitized to structured
 * facts (lib/pipeline/event-types.ts); free text never reaches the table.
 */
export function logEvent(type: EventType, props: EventProps = {}, refs: EventRefs = {}): void {
  try {
    if (!isEventType(type)) {
      console.warn("[events] unknown event type dropped:", type);
      return;
    }
    const { db, userId } = getRequestContext();
    const row = {
      user_id: userId,
      type,
      change_set_id: idOrNull(refs.changeSetId),
      plan_id: idOrNull(refs.planId),
      task_id: idOrNull(refs.taskId),
      props: sanitizeEventProps(props),
    };
    trackPending(Promise.resolve(db.from("events").insert(row)).then(
      ({ error }) => {
        if (error) console.warn("[events] insert failed:", type, error.message);
      },
      (e: unknown) => console.warn("[events] insert failed:", type, e instanceof Error ? e.message : e)
    ));
  } catch (e) {
    console.warn("[events] not logged:", type, e instanceof Error ? e.message : e);
  }
}
