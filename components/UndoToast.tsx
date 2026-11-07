"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState } from "@/components/AppStateProvider";
import Toast, { ToastPortal } from "@/components/ui/Toast";
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

  const hidden = !!toast && toast.from === pathname;

  // While hidden on the page that announced it, the Toast's own timer isn't
  // running, so expire it here.
  useEffect(() => {
    if (!toast || !hidden) return;
    const left = toast.key + UNDO_TOAST_MS - Date.now();
    const id = window.setTimeout(() => setToast(null), Math.max(0, left));
    return () => window.clearTimeout(id);
  }, [toast, hidden]);

  return (
    <ToastPortal>
      {toast && !hidden && (
        <Toast
          key={toast.key}
          tone="success"
          duration={Math.max(1500, toast.key + UNDO_TOAST_MS - Date.now())}
          onDismiss={() => setToast(null)}
        >
          <ActionReceipt actionId={toast.actionId} label={toast.label} onUndone={() => void refresh()} />
        </Toast>
      )}
    </ToastPortal>
  );
}
