// The context engine's slots: what Tangent needs to know to plan a project
// well, how much each one matters, and how close it is to "knows enough".
// Pure: no database, no model. lib/context/flow.ts decides what to ask next.

import { knownKinds, type GrillKind } from "../grill-queue";

export const SLOT_KEYS = ["outcome", "deadline", "hoursPerWeek", "currentLevel", "hardestPart", "constraints", "bestTimeForThis"] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

export const GLOBAL_SLOT_KEYS = ["preferredWorkTimes", "focusLength", "weekendAvailability"] as const;
export type GlobalSlotKey = (typeof GLOBAL_SLOT_KEYS)[number];

export type AnySlot = SlotKey | GlobalSlotKey;

export type SlotSource = "answer" | "inferred" | "default" | "known";

export type SlotValue = {
  value: string | number | string[];
  source: SlotSource;
  updatedAt: string;
};

export type SlotMap<K extends string> = Partial<Record<K, SlotValue>>;

/** Facts Tangent already holds about the student ("What Tangent knows"). */
export type KnownFacts = string[];

export const SLOT_WEIGHTS: Record<SlotKey, number> = {
  deadline: 0.25,
  hoursPerWeek: 0.2,
  outcome: 0.15,
  currentLevel: 0.15,
  bestTimeForThis: 0.1,
  constraints: 0.1,
  hardestPart: 0.05,
};

/** Score at which Tangent stops asking and drafts. */
export const ENOUGH = 0.7;

/** What Tangent assumes when the student skips the two slots a plan can't do without. */
export const SLOT_DEFAULTS = { deadline: "2 weeks", hoursPerWeek: 3 } as const;

/** The two slots that must be settled (answered, inferred or defaulted) before drafting. */
export const REQUIRED_SLOTS: SlotKey[] = ["deadline", "hoursPerWeek"];

export type Sufficiency = { score: number; missing: SlotKey[] };

export function isSlotKey(key: string): key is SlotKey {
  return (SLOT_KEYS as readonly string[]).includes(key);
}

export function isGlobalSlotKey(key: string): key is GlobalSlotKey {
  return (GLOBAL_SLOT_KEYS as readonly string[]).includes(key);
}

/** Grill-queue kinds that already answer a slot. */
const KIND_TO_SLOT: Record<GrillKind, SlotKey> = {
  deadline: "deadline",
  hours: "hoursPerWeek",
  level: "currentLevel",
  hardest: "hardestPart",
  constraints: "constraints",
};

export function slotForKind(kind: string): SlotKey | null {
  return (KIND_TO_SLOT as Record<string, SlotKey>)[kind] ?? null;
}

export function kindForSlot(slot: SlotKey): GrillKind | null {
  const hit = (Object.entries(KIND_TO_SLOT) as [GrillKind, SlotKey][]).find(([, s]) => s === slot);
  return hit ? hit[0] : null;
}

const round = (n: number) => Math.round(n * 100) / 100;

function filled(v: SlotValue | undefined): boolean {
  if (!v) return false;
  if (Array.isArray(v.value)) return v.value.length > 0;
  return String(v.value).trim() !== "";
}

/** How much Tangent knows about this project, 0–1, and which slots are still
 *  open, heaviest first. A known work-time preference covers bestTimeForThis. */
export function computeSufficiency(
  projectSlots: SlotMap<SlotKey>,
  globalSlots: SlotMap<GlobalSlotKey>,
  knownFacts: KnownFacts,
  requestText: string,
  title = "",
): Sufficiency {
  const known = knownKinds(knownFacts, title, requestText);
  let score = 0;
  const missing: SlotKey[] = [];
  for (const slot of SLOT_KEYS) {
    const kind = kindForSlot(slot);
    const has =
      filled(projectSlots[slot]) ||
      (kind !== null && known.has(kind)) ||
      (slot === "bestTimeForThis" && filled(globalSlots.preferredWorkTimes));
    if (has) score += SLOT_WEIGHTS[slot];
    else missing.push(slot);
  }
  missing.sort((a, b) => SLOT_WEIGHTS[b] - SLOT_WEIGHTS[a]);
  return { score: round(score), missing };
}

export function slotValue(value: SlotValue["value"], source: SlotSource, now: Date = new Date()): SlotValue {
  return { value, source, updatedAt: now.toISOString() };
}

/** Display text for a value ("3 hrs a week", "Evenings, Weekends"). */
export function valueText(slot: AnySlot, v: SlotValue): string {
  if (Array.isArray(v.value)) return v.value.join(", ");
  if (slot === "hoursPerWeek" && typeof v.value === "number") return `${v.value} hr${v.value === 1 ? "" : "s"} a week`;
  return String(v.value);
}
