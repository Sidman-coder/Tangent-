"use client";

// Persistent, cross-tab voice capture button — rendered once in AppShell so
// it's available on every page. Same hold-to-record interaction model as
// VoiceRecordButton, same shared recording hook, and the same inline
// toast/ActionReceipt confirmation pattern CommandPalette uses — it never
// opens the command palette or navigates away from the current page.

import { useCallback, useState } from "react";
import { Mic } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import { useVoiceCapture, type VoiceCaptureResult } from "@/hooks/useVoiceCapture";
import { Check } from "lucide-react";

export default function VoiceCaptureFab() {
  const { refresh } = useAppState();
  const [toast, setToast] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const handleResult = useCallback(
    async (result: VoiceCaptureResult) => {
      if (result.action === "confirm_required" && result.pending) {
        setReceiptId(null);
        setPendingConfirm({ id: result.pending.id, message: result.pending.message });
        return;
      }
      setReceiptId(result.actionId ?? null);
      showToast(result.response ?? "Done!");
      await refresh();
    },
    [refresh, showToast]
  );

  const handleError = useCallback(
    (message: string) => {
      setReceiptId(null);
      showToast(message);
    },
    [showToast]
  );

  const { status, startRecording, stopRecording } = useVoiceCapture({
    onResult: handleResult,
    onError: handleError,
  });

  const resolveConfirm = useCallback(
    async (confirm: boolean) => {
      if (!pendingConfirm) return;
      const id = pendingConfirm.id;
      setPendingConfirm(null);
      setBusy(true);
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confirm }),
        });
        const data = (await res.json()) as { ok?: boolean; response?: string; error?: string; actionId?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
        setReceiptId(confirm ? data.actionId ?? null : null);
        showToast(data.response ?? (confirm ? "Done." : "Cancelled."));
        await refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [pendingConfirm, refresh, showToast]
  );

  const label = status === "recording" ? "Listening…" : status === "uploading" ? "Thinking…" : "Hold to talk to TANGENT";

  return (
    <>
      <button
        type="button"
        className={`voice-fab ${status}`}
        title={label}
        aria-label={label}
        disabled={status === "uploading"}
        onMouseDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onMouseUp={stopRecording}
        onMouseLeave={() => {
          if (status === "recording") stopRecording();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onTouchEnd={stopRecording}
        onTouchCancel={stopRecording}
      >
        {status === "recording" ? (
          <span className="voice-fab-dot" />
        ) : status === "uploading" ? (
          <span className="voice-fab-spinner" />
        ) : (
          <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
        )}
      </button>

      {pendingConfirm && (
        <div className="confirm-toast" role="alertdialog" aria-label="Confirm action">
          <span>{pendingConfirm.message}</span>
          <div className="confirm-toast-btns">
            <button type="button" className="surface-action-primary" onClick={() => resolveConfirm(true)} disabled={busy}>
              Confirm
            </button>
            <button type="button" className="surface-action-secondary" onClick={() => resolveConfirm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && !pendingConfirm && (
        <div className="command-toast" role="status">
          {receiptId ? (
            <ActionReceipt
              actionId={receiptId}
              label={toast}
              onUndone={() => {
                setToast("Undone.");
                setReceiptId(null);
                void refresh();
              }}
            />
          ) : (
            <span onClick={() => setToast(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <Check size={18} strokeWidth={1.75} /> {toast}
            </span>
          )}
        </div>
      )}
    </>
  );
}
