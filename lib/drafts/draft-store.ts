// Round 5A 4.2: unconfirmed plan drafts that survive navigation, Gmail-style.
// Kept in sessionStorage (gone when the browser session ends), at most 2.
// A third replaces the oldest only after asking: it waits in `pending` until
// the student says Replace or Discard.
//
// The pure list rules come first (tested in lib/drafts/draft-store.test.ts);
// the sessionStorage wrapper and the "which drafts are open on screen" set
// come after.

import type { ChangeSet } from "../pipeline/changeset";
import type { PreviewPayload } from "../pipeline/draft";

export const MAX_DRAFTS = 2;
export const DRAFTS_KEY = "tangent:drafts";
export const DRAFTS_EVENT = "tangent:drafts";

export type DraftEntry = {
  /** The ChangeSet id. */
  id: string;
  title: string;
  stepCount: number;
  /** The page it was drafted on ("/", "/calendar", "/capture", "/projects/…"). */
  origin: string;
  createdAt: string;
  changeSet: ChangeSet;
  preview: PreviewPayload;
};

export type DraftState = { drafts: DraftEntry[]; pending: DraftEntry | null };

export const EMPTY: DraftState = { drafts: [], pending: null };

type Op = ChangeSet["ops"][number];

/** A plan is worth keeping as a draft: a new project, or two or more steps.
 *  A single "add milk" preview isn't a plan. */
export function isPlanDraft(ops: readonly Op[]): boolean {
  if (ops.some((o) => o.op === "create_plan")) return true;
  return ops.filter((o) => o.op === "add_task").length >= 2;
}

export function stepCountOf(ops: readonly Op[]): number {
  return ops.filter((o) => o.op === "add_task").length;
}

/** The plan's name: the new project's title, else the summary's first words. */
export function draftTitle(cs: Pick<ChangeSet, "ops" | "summary">): string {
  const plan = cs.ops.find((o) => o.op === "create_plan") as { title?: string } | undefined;
  const raw = (plan?.title || cs.summary || "Plan").replace(/\s+/g, " ").trim();
  return raw.length > 48 ? `${raw.slice(0, 47).trimEnd()}…` : raw;
}

/** Add or refresh a draft. A third distinct draft waits in `pending`. */
export function upsertDraft(state: DraftState, entry: DraftEntry): DraftState {
  const at = state.drafts.findIndex((d) => d.id === entry.id);
  if (at >= 0) {
    const drafts = state.drafts.slice();
    drafts[at] = { ...entry, createdAt: state.drafts[at].createdAt };
    return { ...state, drafts };
  }
  if (state.drafts.length < MAX_DRAFTS) return { ...state, drafts: [...state.drafts, entry] };
  return { ...state, pending: entry };
}

/** "Replace": the oldest goes, the pending one takes its place. Returns the
 *  dropped draft so its ChangeSet can be discarded on the server. */
export function acceptPending(state: DraftState): { state: DraftState; dropped: DraftEntry | null } {
  if (!state.pending) return { state, dropped: null };
  const sorted = [...state.drafts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dropped = sorted[0] ?? null;
  const drafts = [...state.drafts.filter((d) => d !== dropped), state.pending];
  return { state: { drafts, pending: null }, dropped };
}

/** Remove by id (confirmed, discarded, or the pending one declined). */
export function removeDraft(state: DraftState, id: string): DraftState {
  return {
    drafts: state.drafts.filter((d) => d.id !== id),
    pending: state.pending?.id === id ? null : state.pending,
  };
}

/** Drafts for the pill: not the ones already open on this screen. */
export function visibleDrafts(state: DraftState, openIds: ReadonlySet<string>): DraftEntry[] {
  return state.drafts.filter((d) => !openIds.has(d.id));
}

/** Parse what sessionStorage held; anything odd reads as empty. */
export function parseDrafts(raw: string | null): DraftState {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<DraftState>;
    const ok = (d: unknown): d is DraftEntry =>
      !!d && typeof d === "object" && typeof (d as DraftEntry).id === "string" && !!(d as DraftEntry).changeSet && !!(d as DraftEntry).preview;
    const drafts = Array.isArray(v.drafts) ? v.drafts.filter(ok).slice(0, MAX_DRAFTS) : [];
    return { drafts, pending: ok(v.pending) ? v.pending : null };
  } catch {
    return EMPTY;
  }
}

// ─── Browser side ──────────────────────────────────────────────────────────

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadDrafts(): DraftState {
  const s = storage();
  try {
    return parseDrafts(s?.getItem(DRAFTS_KEY) ?? null);
  } catch {
    return EMPTY;
  }
}

export function saveDrafts(state: DraftState): void {
  const s = storage();
  try {
    if (state.drafts.length === 0 && !state.pending) s?.removeItem(DRAFTS_KEY);
    else s?.setItem(DRAFTS_KEY, JSON.stringify(state));
  } catch {
    /* full or blocked: the draft just doesn't survive */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DRAFTS_EVENT));
}

export function updateDrafts(fn: (s: DraftState) => DraftState): DraftState {
  const next = fn(loadDrafts());
  saveDrafts(next);
  return next;
}

/** Keep an unconfirmed plan that's leaving the screen. */
export function keepDraft(changeSet: ChangeSet, preview: PreviewPayload, origin: string): void {
  if (!isPlanDraft(changeSet.ops)) return;
  updateDrafts((s) =>
    upsertDraft(s, {
      id: changeSet.id,
      title: draftTitle(changeSet),
      stepCount: stepCountOf(changeSet.ops),
      origin,
      createdAt: new Date().toISOString(),
      changeSet,
      preview,
    })
  );
}

export function forgetDraft(id: string): void {
  if (!loadDrafts().drafts.some((d) => d.id === id) && loadDrafts().pending?.id !== id) return;
  updateDrafts((s) => removeDraft(s, id));
}

export function findDraft(id: string): DraftEntry | null {
  const s = loadDrafts();
  return s.drafts.find((d) => d.id === id) ?? (s.pending?.id === id ? s.pending : null);
}

// Which drafts are open on screen right now (a mounted preview), so the pill
// hides them: "Hidden on the page where the draft is already open."
const open = new Map<string, number>();

export function markOpen(id: string): () => void {
  open.set(id, (open.get(id) ?? 0) + 1);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DRAFTS_EVENT));
  return () => {
    const n = (open.get(id) ?? 1) - 1;
    if (n <= 0) open.delete(id);
    else open.set(id, n);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DRAFTS_EVENT));
  };
}

export function openDraftIds(): Set<string> {
  return new Set(open.keys());
}
