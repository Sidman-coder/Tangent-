"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import {
  OPEN_PALETTE_EVENT,
  routeVoiceTranscript,
  useVoiceCapture,
  type OpenPaletteDetail,
} from "@/hooks/useVoiceCapture";
import { Check } from "lucide-react";

type QuickAction = {
  label: string;
  kind: "prefill" | "ask" | "navigate";
  value: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add a task", kind: "prefill", value: "Add a task: " },
  { label: "Create a plan", kind: "prefill", value: "Create a plan for " },
  { label: "What's on today?", kind: "ask", value: "What's on today?" },
  { label: "Summarize my email", kind: "ask", value: "Summarize my email" },
  { label: "Go to calendar", kind: "navigate", value: "/calendar" },
];

function cleanReply(text: string): string {
  if (!text) return "Done! Your request has been processed.";
  let cleaned = text.replace(/```[\s\S]*?```/gi, "").trim();
  if (cleaned.startsWith("{") || cleaned.includes('"action"') || cleaned.includes('"tasks"')) {
    return "Done! Your request has been processed.";
  }
  return cleaned || "Done! Your request has been processed.";
}

function isFormField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export default function CommandPalette() {
  const router = useRouter();
  const { refresh } = useAppState();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; message: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const closePalette = useCallback(() => {
    setOpen(false);
    setValue("");
    setHighlighted(0);
  }, []);

  // Open via ⌘K / Ctrl+K, or via the topbar command input dispatching this event.
  // A voice transcript arrives as `detail.prefill`: it lands in the input,
  // editable, cursor at the end — the student presses Enter to actually ask.
  useEffect(() => {
    const onOpenEvent = (e: Event) => {
      const prefill = (e as CustomEvent<OpenPaletteDetail>).detail?.prefill;
      setOpen(true);
      if (prefill) {
        setValue(prefill);
        setHighlighted(0);
        setTimeout(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(prefill.length, prefill.length);
        }, 30);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const submitAsk = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      closePalette();
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: trimmed }] }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          reply?: string;
          response?: string;
          text?: string;
          error?: string;
          action?: string;
          actionId?: string;
          pending?: { id: string; kind: string; message: string };
        };
        if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
        if (data.action === "confirm_required" && data.pending) {
          setReceiptId(null);
          setPendingConfirm({ id: data.pending.id, message: data.pending.message });
          return;
        }
        const raw = data.message ?? data.reply ?? data.response ?? data.text ?? "";
        setReceiptId(data.actionId ?? null);
        showToast(cleanReply(typeof raw === "string" ? raw : ""));
        await refresh();
      } catch (e) {
        setReceiptId(null);
        showToast(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [busy, closePalette, refresh, showToast]
  );

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

  const runQuickAction = useCallback(
    (action: QuickAction) => {
      if (action.kind === "navigate") {
        closePalette();
        router.push(action.value);
        return;
      }
      if (action.kind === "ask") {
        void submitAsk(action.value);
        return;
      }
      // prefill — keep palette open, let the user finish typing
      setValue(action.value);
      setHighlighted(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(action.value.length, action.value.length);
      }, 0);
    },
    [closePalette, router, submitAsk]
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }
      if (value.trim().length === 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlighted((h) => (h + 1) % QUICK_ACTIONS.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlighted((h) => (h - 1 + QUICK_ACTIONS.length) % QUICK_ACTIONS.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          runQuickAction(QUICK_ACTIONS[highlighted]);
          return;
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        void submitAsk(value);
      }
    },
    [value, highlighted, closePalette, runQuickAction, submitAsk]
  );

  // Hold Space (400ms) to start voice recording, when no form field is focused and the palette is closed.
  // The transcript is routed to an editable input (the AI console's composer if
  // it's on screen, otherwise this palette, pre-filled) — never auto-submitted.
  const handleVoiceError = useCallback(
    (message: string) => {
      setReceiptId(null);
      showToast(message);
    },
    [showToast]
  );

  const { status: voiceStatus, startRecording: startVoiceRecording, stopRecording: stopVoiceRecording } = useVoiceCapture({
    onTranscript: routeVoiceTranscript,
    onError: handleVoiceError,
  });

  // The recorder callbacks change identity with every status change; read them
  // through refs so the key listeners (and their `holding` flag) stay mounted
  // for the whole press instead of resetting mid-recording.
  const startVoiceRef = useRef(startVoiceRecording);
  const stopVoiceRef = useRef(stopVoiceRecording);
  startVoiceRef.current = startVoiceRecording;
  stopVoiceRef.current = stopVoiceRecording;

  useEffect(() => {
    let holdTimer: number | null = null;
    let holding = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isFormField(e.target) || openRef.current) return;
      if (holdTimer !== null || holding) return;
      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        holding = true;
        void startVoiceRef.current();
      }, 400);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (holding) {
        holding = false;
        stopVoiceRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (holdTimer !== null) clearTimeout(holdTimer);
    };
  }, []);

  return (
    <>
      {open && (
        <div className="cmdk-overlay" onClick={closePalette}>
          <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="Command palette">
            <input
              ref={inputRef}
              className="cmdk-input"
              value={value}
              onChange={(e) => { setValue(e.target.value); setHighlighted(0); }}
              onKeyDown={onInputKeyDown}
              placeholder="Add a task, ask a question…"
              aria-label="Command"
              disabled={busy}
            />
            <div className="cmdk-list" role="listbox" aria-label="Quick actions">
              {value.trim().length === 0 ? (
                QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={action.label}
                    type="button"
                    className={`cmdk-item${i === highlighted ? " is-highlighted" : ""}`}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => runQuickAction(action)}
                    role="option"
                    aria-selected={i === highlighted}
                  >
                    {action.label}
                  </button>
                ))
              ) : (
                <div className="cmdk-hint">Press Enter to ask TANGENT</div>
              )}
            </div>
          </div>
        </div>
      )}

      {voiceStatus !== "idle" && (
        <div className="voice-pill" role="status">
          {voiceStatus === "recording" ? (
            <>
              <span className="voice-pill-dot" /> Listening…
            </>
          ) : (
            <>
              <span className="voice-pill-spinner" aria-hidden="true" /> Transcribing…
            </>
          )}
        </div>
      )}

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
