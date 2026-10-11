// Undo that outlives the page it happened on (safety hotfix). Pure, so the
// rules are unit tested with plain Node; the UI lives in components/UndoToast
// and components/RecentChanges, both mounted once in AppShell.

/** Window event: a change was just made; show the app-level Undo toast. */
export const UNDO_TOAST_EVENT = "tangent:undo-toast";
/** Window event: open the Recent changes panel (Calendar page, command palette). */
export const OPEN_RECENT_CHANGES_EVENT = "tangent:open-recent-changes";

/** How long the app-level Undo toast stays up, across page changes. */
export const UNDO_TOAST_MS = 8000;
/** How many changes the Recent changes panel lists. */
export const RECENT_CHANGES_LIMIT = 10;

export type UndoToastDetail = {
  actionId: string;
  label: string;
  /** The page it was announced from. That page shows its own Undo, so the
   *  toast only appears once the student navigates elsewhere. */
  from?: string;
};

/** Announces a change for the app-level Undo toast (browser only). */
export function announceUndo(detail: UndoToastDetail): void {
  if (typeof window === "undefined" || !detail.actionId) return;
  window.dispatchEvent(new CustomEvent<UndoToastDetail>(UNDO_TOAST_EVENT, { detail }));
}

export function openRecentChanges(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_RECENT_CHANGES_EVENT));
}

/** The fields of an action record the UI needs (GET /api/actions). */
export type UndoRecord = { id: string; summary: string; createdAt: string; undoable: boolean; undone: boolean };

/**
 * undoable: Undo still works. undone: already undone. expired: the record is
 * gone (trimmed past the newest 50, or not this student's) or can't be undone;
 * shown as "Can't undo anymore".
 */
export type UndoStatus = "undoable" | "undone" | "expired";

export function undoStatusOf(actionId: string, records: UndoRecord[]): UndoStatus {
  const r = records.find((x) => x.id === actionId);
  if (!r || !r.undoable) return "expired";
  return r.undone ? "undone" : "undoable";
}

/** The newest `limit` changes that can still be undone, newest first. */
export function recentUndoable(records: UndoRecord[], limit = RECENT_CHANGES_LIMIT): UndoRecord[] {
  return records
    .filter((r) => r.undoable && !r.undone)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

/** Server messages that mean the action is gone, not that undo failed. */
export function isExpiredUndoMessage(message: string): boolean {
  return /could not be found|can't be undone|already undone/i.test(message);
}

type UndoTurn = { actionId?: string; actionLabel?: string; undoStatus?: UndoStatus };

/** Action ids a reopened chat needs to re-check. */
export function actionIdsOf(turns: UndoTurn[]): string[] {
  return Array.from(new Set(turns.map((t) => t.actionId).filter((id): id is string => !!id)));
}

/**
 * A reopened chat's turns with Undo restored from the saved action ids:
 * each gets its record's summary as the label and its current status.
 */
export function withUndoStatus<T extends UndoTurn>(turns: T[], records: UndoRecord[]): T[] {
  return turns.map((t) => {
    if (!t.actionId) return t;
    const record = records.find((r) => r.id === t.actionId);
    return { ...t, actionLabel: t.actionLabel ?? record?.summary ?? "Change applied", undoStatus: undoStatusOf(t.actionId, records) };
  });
}

/** "2:05 PM" today, else "Oct 9, 2:05 PM". */
export function changeTime(iso: string, now = new Date(), timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x: Date) => x.toLocaleDateString("en-US", { timeZone });
  const time = d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return day(d) === day(now) ? time : `${d.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" })}, ${time}`;
}
