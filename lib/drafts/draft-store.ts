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
  /** Round 6: the pill's Hide. Nothing is discarded; the pill shows only on
   *  the page it was drafted on. */
  hidden?: boolean;
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
    drafts[at] = { ...entry, createdAt: state.drafts[at].createdAt, hidden: entry.hidden ?? state.drafts[at].hidden };
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

/** The page part of an origin ("/projects/p1?x=1" → "/projects/p1"). */
export function originPath(origin: string): string {
  return origin.split(/[?#]/)[0] || "/";
}

const GENERIC = new Set([
  "plan", "prep", "steps", "step", "study", "week", "your", "with", "this", "that", "from", "into",
  // Round 6 live check 3: words any request starts with ("help me write…", "add to project").
  "help", "want", "need", "needs", "write", "make", "ready", "have", "about", "before", "after", "project",
]);
function titleWords(title: string): Set<string> {
  return new Set((title.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 4 && !GENERIC.has(w)));
}

/** What a draft is about: its name, plus the student's own first line (a
 *  draft that went into an existing project is just "Add to project"). */
function topicWords(cs: Pick<ChangeSet, "ops" | "summary"> & { request_text?: string }): Set<string> {
  const said = (cs.request_text ?? "").split(/\n/)[0] ?? "";
  return new Set([...Array.from(titleWords(draftTitle(cs))), ...Array.from(titleWords(said))]);
}

/** Round 6: an earlier version of the same plan conversation. Each re-plan
 *  reply makes a new ChangeSet; they share the page they were drafted on and
 *  either the project they're about or a word of the plan's name. */
export function sameConversation(older: DraftEntry, confirmed: { origin: string; changeSet: ChangeSet }): boolean {
  if (originPath(older.origin) !== originPath(confirmed.origin)) return false;
  const a = older.changeSet.target_plan_id;
  const b = confirmed.changeSet.target_plan_id;
  if (a && b) return a === b;
  const mine = topicWords(confirmed.changeSet);
  return Array.from(topicWords(older.changeSet)).some((w) => mine.has(w));
}

/** Round 6 item 3: Confirm clears its own pill and every older version of
 *  the same conversation (Leo and Priya kept a stale "5 steps" pill). */
export function settleDrafts(state: DraftState, confirmed: { id: string; origin: string; changeSet: ChangeSet }): DraftState {
  const own = state.drafts.find((d) => d.id === confirmed.id);
  const cutoff = own?.createdAt ?? new Date(8.64e15).toISOString();
  const origin = own?.origin ?? confirmed.origin;
  const stale = (d: DraftEntry) =>
    d.id === confirmed.id || (d.createdAt <= cutoff && sameConversation(d, { origin, changeSet: confirmed.changeSet }));
  return {
    drafts: state.drafts.filter((d) => !stale(d)),
    pending: state.pending && stale(state.pending) ? null : state.pending,
  };
}

/** Round 6 item 3: the pill's Hide. */
export function hideDraft(state: DraftState, id: string): DraftState {
  return { ...state, drafts: state.drafts.map((d) => (d.id === id ? { ...d, hidden: true } : d)) };
}

/** The server refuses to confirm a draft older than this
 *  (lib/pipeline/card-actions.ts DRAFT_TTL_MS), so the pill stops offering it. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Past the server's limit: Confirm would only say "This draft expired". An
 *  unknown age counts as fresh; the server still has the last word. */
export function isExpiredDraft(entry: DraftEntry, now: number = Date.now()): boolean {
  const made = Date.parse(entry.changeSet?.created_at ?? "");
  return Number.isFinite(made) && made < now - DRAFT_TTL_MS;
}

/** Drafts for the pill: not the ones already open on this screen, and not
 *  ones too old to confirm (overnight 2, Sam sim: an old test-account draft
 *  was offered, Confirm got a 409, and the card vanished). */
export function visibleDrafts(
  state: DraftState,
  openIds: ReadonlySet<string>,
  now: number = Date.now(),
  /** Round 6: a hidden draft's pill shows only on the page it came from. */
  pathname?: string,
): DraftEntry[] {
  return state.drafts.filter(
    (d) =>
      !openIds.has(d.id) &&
      !isExpiredDraft(d, now) &&
      (!d.hidden || (pathname !== undefined && originPath(d.origin) === originPath(pathname))),
  );
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

// Round 6: ids already confirmed this session. A plan card still mounted in
// an old message (or remounted later) can't put its draft back.
export const SETTLED_KEY = "tangent:drafts-settled";
const MAX_SETTLED = 50;

function settledIds(): string[] {
  try {
    const v = JSON.parse(storage()?.getItem(SETTLED_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Confirmed: this draft and its older versions are done. */
export function settleDraft(changeSet: ChangeSet, origin: string): void {
  const before = loadDrafts();
  const after = settleDrafts(before, { id: changeSet.id, origin, changeSet });
  const gone = before.drafts.filter((d) => !after.drafts.includes(d)).map((d) => d.id);
  try {
    const ids = Array.from(new Set([...settledIds(), changeSet.id, ...gone])).slice(-MAX_SETTLED);
    storage()?.setItem(SETTLED_KEY, JSON.stringify(ids));
  } catch {
    /* blocked storage: the store change below still clears the pill */
  }
  saveDrafts(after);
}

/** Keep an unconfirmed plan that's leaving the screen. */
export function keepDraft(changeSet: ChangeSet, preview: PreviewPayload, origin: string): void {
  if (!isPlanDraft(changeSet.ops)) return;
  if (settledIds().includes(changeSet.id)) return;
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
