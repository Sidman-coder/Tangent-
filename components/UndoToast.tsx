"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState } from "@/components/AppStateProvider";
import { UNDO_TOAST_EVENT, UNDO_TOAST_MS, type UndoToastDetail } from "@/lib/undo-events";

/**
 * App-level Undo for about 8 seconds after a change, across page changes.
 * Mounted once in AppShell. A change announced from a page that shows its own
 * Undo (the AI console) only appears here once the student leaves that page.
 */
export default function UndoToast() {
  const pathname = usePathname();
  const { refresh } = useAppState();
  const [toast, setToast] = useState<(UndoToastDetail & { key: number }) | null>(null);

  useEffect(() => {
    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent<UndoToastDetail>).detail;
      if (detail?.actionId) setToast({ ...detail, key: Date.now() });
    };
    window.addEventListener(UNDO_TOAST_EVENT, onAnnounce);
    return () => window.removeEventListener(UNDO_TOAST_EVENT, onAnnounce);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), UNDO_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast || toast.from === pathname) return null;
  return (
    <div className="command-toast" role="status">
      <ActionReceipt key={toast.key} actionId={toast.actionId} label={toast.label} onUndone={() => void refresh()} />
    </div>
  );
}
