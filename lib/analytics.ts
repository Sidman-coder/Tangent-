import "server-only";

// Pilot analytics (Round 2, F.3): one server-side call, trackEvent(), that
// writes a row to the events table (the same table as the Pipeline V2 funnel,
// lib/pipeline/events.ts). Names and props are allowlisted in
// lib/analytics-events.ts. Never throws and never blocks the reply for long:
// the insert is tracked on the request like logEvent's.
//
// The pilot queries live in docs/tangent/pilot-metrics.sql.

import { getRequestContext, trackPending } from "./request-context";
import { ONCE_PER_USER, isPilotEvent, isWeek2Window, pilotProps, type PilotEvent, type PilotProps } from "./analytics-events";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === "string" && UUID_RE.test(v) ? v : null);

/** The "first" event each everyday event also fires, once. */
const FIRST_OF: Partial<Record<PilotEvent, PilotEvent>> = {
  capture: "first_capture",
  plan_confirmed: "first_plan_confirmed",
};

async function insert(name: PilotEvent, props: PilotProps): Promise<void> {
  const { db, userId } = getRequestContext();
  if (ONCE_PER_USER.includes(name)) {
    const { data } = await db.from("events").select("id").eq("user_id", userId).eq("type", name).limit(1);
    if (data && data.length > 0) return;
  }
  const { error } = await db.from("events").insert({
    user_id: userId,
    type: name,
    plan_id: uuid(props.plan_id),
    task_id: uuid(props.task_id),
    props: pilotProps(props),
  });
  if (error) console.warn("[analytics] not recorded:", name, error.message);
}

export function trackEvent(name: PilotEvent, props: PilotProps = {}): void {
  try {
    if (!isPilotEvent(name)) {
      console.warn("[analytics] unknown event dropped:", name);
      return;
    }
    const first = FIRST_OF[name];
    const work = insert(name, props).then(() => (first ? insert(first, props) : undefined));
    trackPending(work.catch((e: unknown) => console.warn("[analytics] not recorded:", name, e instanceof Error ? e.message : e)));
  } catch (e) {
    console.warn("[analytics] not recorded:", name, e instanceof Error ? e.message : e);
  }
}

/** On every app open (GET /api/state): signup on the first one ever, and
 *  week_two_return on the first open between day 7 and day 14 after signup
 *  (the login's created_at). Both are once-per-user, so this is cheap after. */
export function trackAppOpen(): void {
  try {
    trackEvent("signup");
    const { db } = getRequestContext();
    trackPending(
      db.auth
        .getUser()
        .then(({ data }) => {
          const created = data.user?.created_at;
          if (created && isWeek2Window(created)) trackEvent("week_two_return");
        })
        .catch(() => undefined)
    );
  } catch {
    // Analytics never breaks a page load.
  }
}
