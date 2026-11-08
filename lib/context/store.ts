import "server-only";

// context_slots: what Tangent knows per project (and about the student, with
// project_id null). Before the migration runs every read returns null, which
// tells callers to fall back to the older clarify questions.

import { getRequestContext } from "@/lib/request-context";
import { schemaErrorKind, warnSchemaOnce } from "@/lib/schema-compat";
import { isGlobalSlotKey, isSlotKey, type AnySlot, type GlobalSlotKey, type SlotKey, type SlotMap, type SlotSource, type SlotValue } from "./slots";

type Row = { project_id: string | null; slot_key: string; value: unknown; source: SlotSource; updated_at: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function missing(error: { code?: string; message?: string }): boolean {
  if (schemaErrorKind(error) !== "missing_table") return false;
  warnSchemaOnce("context_slots", "context_slots table missing: run the Round 2 migration in docs/MANUAL-STEPS.md. Planning uses the older questions until then.");
  return true;
}

function toValue(row: Row): SlotValue | null {
  const v = row.value;
  if (typeof v === "string" || typeof v === "number") return { value: v, source: row.source, updatedAt: row.updated_at };
  if (Array.isArray(v)) return { value: v.map(String), source: row.source, updatedAt: row.updated_at };
  return null;
}

export type ContextSlots = { project: SlotMap<SlotKey>; global: SlotMap<GlobalSlotKey>; byProject: Map<string, SlotMap<SlotKey>> };

/** Every slot the student has, or null before the migration. */
export async function getContextSlots(): Promise<ContextSlots | null>;
export async function getContextSlots(projectId: string | null): Promise<ContextSlots | null>;
export async function getContextSlots(projectId: string | null = null): Promise<ContextSlots | null> {
  const { db, userId } = getRequestContext();
  const { data, error } = await db.from("context_slots").select("project_id, slot_key, value, source, updated_at").eq("user_id", userId).limit(2000);
  if (error) {
    if (missing(error)) return null;
    console.warn("[context] could not read slots:", error.code ?? "unknown");
    return null;
  }
  const out: ContextSlots = { project: {}, global: {}, byProject: new Map() };
  for (const row of (data ?? []) as Row[]) {
    const value = toValue(row);
    if (!value) continue;
    if (row.project_id === null) {
      if (isGlobalSlotKey(row.slot_key)) out.global[row.slot_key] = value;
      continue;
    }
    if (!isSlotKey(row.slot_key)) continue;
    const map = out.byProject.get(row.project_id) ?? {};
    map[row.slot_key] = value;
    out.byProject.set(row.project_id, map);
  }
  if (projectId) out.project = out.byProject.get(projectId) ?? {};
  return out;
}

/** Saves slots (project_id null for the student's own). Returns false before
 *  the migration or on any failure: slots are a help, never a blocker. */
export async function saveContextSlots(projectId: string | null, slots: Partial<Record<AnySlot, SlotValue>>): Promise<boolean> {
  if (projectId !== null && !UUID_RE.test(projectId)) return false;
  const rows = Object.entries(slots)
    .filter(([key, v]) => v && (projectId === null ? isGlobalSlotKey(key) : isSlotKey(key)))
    .map(([key, v]) => ({ project_id: projectId, slot_key: key, value: (v as SlotValue).value, source: (v as SlotValue).source, updated_at: (v as SlotValue).updatedAt }));
  if (!rows.length) return true;
  const { db, userId } = getRequestContext();
  const { error } = await db
    .from("context_slots")
    .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,project_id,slot_key" });
  if (error) {
    if (!missing(error)) console.warn("[context] could not save slots:", error.code ?? "unknown");
    return false;
  }
  return true;
}
