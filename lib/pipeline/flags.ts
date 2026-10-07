// Pipeline V2 feature flag, read in one place. Off unless the server env sets
// TANGENT_PIPELINE_V2=true (or 1). Read once at module load: when on, typed AI
// changes from /api/chat become draft ChangeSets (lib/voice-handler.ts) and the
// app/api/changesets routes answer; when off, both behave as before.

function flagOn(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export const TANGENT_PIPELINE_V2: boolean = flagOn(process.env.TANGENT_PIPELINE_V2);
