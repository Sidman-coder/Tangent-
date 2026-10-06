// Pipeline V2 feature flag, read in one place. Off unless the server env sets
// TANGENT_PIPELINE_V2=true (or 1). Nothing reads it yet; Prompt 1 will.

function flagOn(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export const TANGENT_PIPELINE_V2: boolean = flagOn(process.env.TANGENT_PIPELINE_V2);
