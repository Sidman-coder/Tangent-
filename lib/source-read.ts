// Did a data-read tool actually bring data back? (overnight C02)
//
// The agent loop used to label a source ("Canvas", "Gmail") as soon as the
// model *called* the tool, so a plan could say "Based on what Tangent read in
// Canvas and Gmail" when neither was connected. A source only counts once the
// tool returned real data: no `error`, and not `connected: false`.

export function toolReadSucceeded(payload: unknown): boolean {
  if (payload === null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if ("error" in p && p.error) return false;
  if (p.connected === false) return false;
  return true;
}

/** "Canvas", "Canvas and Gmail", "Canvas, Gmail and your calendar". */
export function joinSources(sources: readonly string[]): string {
  if (sources.length <= 1) return sources.join("");
  return `${sources.slice(0, -1).join(", ")} and ${sources[sources.length - 1]}`;
}
