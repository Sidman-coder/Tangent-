"use client";

import { useCallback, useEffect, useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { OPEN_RECENT_CHANGES_EVENT, changeTime, recentUndoable, type UndoRecord } from "@/lib/undo-events";

/**
 * "Recent changes": the student's last 10 changes that can still be undone,
 * newest first, each with Undo (the existing /api/actions route). Opened from
 * the Calendar page and the command palette ("Undo recent change"); mounted
 * once in AppShell. Reuses the palette's overlay and receipt styles.
 */
export default function RecentChanges() {
  const { refresh } = useAppState();
  const tz = useUserTimezone();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UndoRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/actions?limit=50", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: UndoRecord[] };
      if (!res.ok || !data.ok) throw new Error();
      setItems(recentUndoable(data.actions ?? []));
    } catch {
      setItems([]);
      setError("Couldn't load your recent changes.");
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setItems(null);
      void load();
    };
    window.addEventListener(OPEN_RECENT_CHANGES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RECENT_CHANGES_EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="Recent changes">
        <div className="cmdk-list">
          <div className="cmdk-hint">Recent changes</div>
          {items === null ? (
            <div className="cmdk-hint">Loading…</div>
          ) : items.length === 0 ? (
            <div className="cmdk-hint">{error ?? "Nothing to undo."}</div>
          ) : (
            items.map((r) => (
              <div key={r.id} className="cmdk-item">
                <ActionReceipt actionId={r.id} label={`${r.summary} · ${changeTime(r.createdAt, new Date(), tz)}`} onUndone={() => void refresh()} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
