"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { usePipelineV2 } from "@/components/PipelineFlag";
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
  // Pipeline V2: undo entries Tangent AI made get a Details link to Settings › AI Activity.
  const v2 = usePipelineV2();
  const [aiIds, setAiIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    if (v2) {
      void fetch("/api/ai-activity?only=action_ids", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ actionIds?: string[] }>) : null))
        .then((d) => setAiIds(new Set(d?.actionIds ?? [])))
        .catch(() => {});
    }
    try {
      const res = await fetch("/api/actions?limit=50", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: UndoRecord[] };
      if (!res.ok || !data.ok) throw new Error();
      setItems(recentUndoable(data.actions ?? []));
    } catch {
      setItems([]);
      setError("Couldn't load your recent changes.");
    }
  }, [v2]);

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
                {aiIds.has(r.id) && (
                  <Link className="action-receipt-details" href={`/settings?activity=action:${r.id}#ai-activity`} onClick={() => setOpen(false)}>
                    Details
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
