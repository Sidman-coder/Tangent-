// Round 5B Phase 3: adding and telling facts on "You, mapped". Pure, so the
// rules are unit tested: which category an area's "+ Add" writes, the
// local-only write the dev sample uses, and what Tangent says back.

import type { ContextEntry } from "./types";
import { prepareFact, type FactCategory } from "./student/facts";
import { looksDistressed, DISTRESS_REPLY } from "./student/sensitive";
import { MAP_GROUPS, groupOf, type MapGroupKey } from "./you-map";

/** What "+ Add" in each area writes, so the new fact lands in that area. */
export const AREA_CATEGORY: Record<MapGroupKey, { factCategory: FactCategory; category: ContextEntry["category"] }> = {
  goals: { factCategory: "goals", category: "goal" },
  classes: { factCategory: "classes_activities", category: "general" },
  commitments: { factCategory: "schedule", category: "commitment" },
  work: { factCategory: "how_you_work", category: "habit" },
  hard: { factCategory: "whats_hard", category: "general" },
  future: { factCategory: "future", category: "goal" },
};

/** Said when a fact isn't kept (same words as POST /api/context). */
export const NOT_KEPT =
  "Tangent doesn't keep that one. Personal details like health or family stay out of what it remembers, and it needs something specific to plan with.";

export type LocalWrite = { ok: true; entry: ContextEntry } | { ok: false; error: string };

let localSeq = 0;

/** The dev sample's write: the same filter as the server, nothing saved. */
export function localFact(text: string, opts: { factCategory?: FactCategory; projectId?: string | null; now?: Date } = {}): LocalWrite {
  const prepared = prepareFact({ category: "general", fact: text, source: "manual", factCategory: opts.factCategory });
  if (!prepared.ok) return { ok: false, error: NOT_KEPT };
  return {
    ok: true,
    entry: {
      id: `local-${Date.now().toString(36)}-${++localSeq}`,
      timestamp: (opts.now ?? new Date()).toISOString(),
      category: "general",
      fact: prepared.display,
      original: prepared.fact,
      source: "manual",
      factCategory: prepared.factCategory,
      factSource: prepared.factSource,
      projectId: opts.projectId ?? null,
    },
  };
}

/** What Tangent says back in the thread above the Tell pill. */
export function tellReply(text: string, added: Pick<ContextEntry, "fact" | "factCategory" | "category">[], error?: string): string {
  if (looksDistressed(text)) return DISTRESS_REPLY;
  if (added.length === 0) return error ?? "Nothing new to keep from that. Tell me something about your week, your classes or what you're aiming for.";
  const label = (e: (typeof added)[number]) => MAP_GROUPS.find((g) => g.key === groupOf(e))?.label ?? "How you work";
  if (added.length === 1) return `Got it. I'll remember that under ${label(added[0])}: “${added[0].fact}”`;
  return `Got it. I'll remember ${added.length} things:\n${added.map((e) => `• ${e.fact} (${label(e)})`).join("\n")}`;
}
