// Pipeline V2 feature flag, read in one place. Off unless the server env sets
// TANGENT_PIPELINE_V2=true (or 1). Read once at module load: when on, typed AI
// changes from /api/chat become draft ChangeSets (lib/voice-handler.ts) and the
// app/api/changesets routes answer; when off, both behave as before.

function flagOn(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export const TANGENT_PIPELINE_V2: boolean = flagOn(process.env.TANGENT_PIPELINE_V2);

/** Round 5A (Sid, Q3): planning is always previewed first, flag or no flag.
 *  A plan draft is created, confirmed, edited and discarded through the
 *  changeset routes even with TANGENT_PIPELINE_V2 off; every other kind of
 *  draft (a single task, a change, a delete) stays behind the flag. */
export const PLANNING_INTENTS: readonly string[] = ["new_plan", "add_to_plan", "change_plan"];

/** Whether a draft with this intent may be used right now. */
export function draftsOnFor(intent: string, flag: boolean = TANGENT_PIPELINE_V2): boolean {
  return flag || PLANNING_INTENTS.includes(intent);
}
