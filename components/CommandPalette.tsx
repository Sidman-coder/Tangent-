"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppState } from "@/components/AppStateProvider";
import Link from "next/link";
import { contextActions, type ContextAction } from "@/lib/context-actions";
import { useQuestionSets } from "@/hooks/useQuestionSets";
import { useUserTimezone } from "@/components/AppStateProvider";
import { localNow } from "@/lib/time";
import AddFlow from "@/components/add/AddFlow";
import { generateQuestions } from "@/lib/questions-client";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { usePipelineV2 } from "@/components/PipelineFlag";
import { chatOnly, fetchOpenDrafts } from "@/components/console/pipeline-intake";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import {
  OPEN_PALETTE_EVENT,
  routeVoiceTranscript,
  useVoiceCapture,
  type OpenPaletteDetail,
} from "@/hooks/useVoiceCapture";
import { Check } from "lucide-react";
import { captureCopy, prefsOf, type CaptureQuickAction } from "@/lib/personalize";
import { UNDO_TOAST_MS, openRecentChanges } from "@/lib/undo-events";

/** Context actions (lib/context-actions.ts) plus "Undo recent change", which opens Recent changes. */
type QuickAction = ContextAction | { label: string; detail?: string; kind: "recent"; value: string };
const UNDO_RECENT: QuickAction = { label: "Undo recent change", kind: "recent", value: "" };

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
  const { state, refresh } = useAppState();
  // Onboarding answers tune the first quick action and the placeholder; with
  // no answers these are the palette's original defaults.
  const slipPoint = state?.user?.slipPoint;
  const helpFocus = state?.user?.helpFocus;
  const { placeholder } = useMemo(() => captureCopy(prefsOf({ slipPoint, helpFocus })), [slipPoint, helpFocus]);
  // Before you type, Tell Tangent offers what it knows matters now
  // (lib/context-actions.ts) rather than a generic list.
  const { sets: questionSets } = useQuestionSets();
  const tz = useUserTimezone();
  const QUICK_ACTIONS: QuickAction[] = useMemo(() => {
    const now = localNow(tz);
    const ctx = contextActions({
      tasks: state?.tasks ?? [],
      plans: state?.plans ?? [],
      questionCount: questionSets.reduce((n, q) => n + q.questions.length, 0),
      now: { date: now.date, minutes: now.minutes },
      capacity: state?.user.capacity ?? null,
    });
    return [...ctx, { label: "What's on today?", kind: "ask", value: "What's on today?" }, UNDO_RECENT];
  }, [state, questionSets, tz]);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  // What the add sheet opens with: a voice transcript, a tour demo, a quick
  // action's words, or listening straight away (the top bar's mic).
  const [seed, setSeed] = useState<{ key: number; text: string; listen: boolean }>({ key: 0, text: "", listen: false });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Where the thing just created lives, so the confirmation can link to it.
  const [toastLink, setToastLink] = useState<{ href: string; label: string } | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; message: string } | null>(null);
  /** Pipeline V2 (flag on only): a drafted change waiting for Confirm. */
  const [draft, setDraft] = useState<{ changeSet: ChangeSet; preview: PreviewPayload } | null>(null);
  const draftTimer = useRef<number | null>(null);

  /** Hide the settled card after a while; long enough to press Undo. */
  const onDraftSettled = useCallback((phase: string) => {
    if (draftTimer.current !== null) clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => setDraft(null), phase === "confirmed" ? 8000 : 2500);
  }, []);

  const openRef = useRef(open);
  openRef.current = open;

  const closePalette = useCallback(() => {
    setOpen(false);
    setValue("");
  }, []);

  // Open via ⌘K / Ctrl+K, or via the topbar command input dispatching this event.
  // A voice transcript arrives as `detail.prefill`: it lands in the input,
  // editable, cursor at the end — the student presses Enter to actually ask.
  useEffect(() => {
    const onOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<OpenPaletteDetail & { listen?: boolean }>).detail;
      setSeed((s) => ({ key: s.key + 1, text: detail?.prefill ?? "", listen: Boolean(detail?.listen) }));
      setOpen(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSeed((s) => ({ key: s.key + 1, text: "", listen: false }));
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePalette();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePalette]);

  // Pipeline V2: on open, bring back the newest draft still waiting for Confirm.
  const v2 = usePipelineV2();
  useEffect(() => {
    if (open && v2) void fetchOpenDrafts().then((d) => d[0] && setDraft((cur) => cur ?? d[0]));
  }, [open, v2]);

  // A toast with Undo stays as long as the app-level Undo toast (8 s).
  const showToast = useCallback((text: string, withUndo = false) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), withUndo ? UNDO_TOAST_MS : 6000);
  }, []);

  const submitAsk = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      closePalette();
      // Never close silently: say it's working until the result replaces this.
      setReceiptId(null);
      setToastLink(null);
      setToast("Saving…");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: trimmed }], capture: true }),
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
          taskId?: string;
          taskDate?: string;
          projectId?: string;
          quick?: boolean;
          pending?: { id: string; kind: string; message: string };
          changeSet?: ChangeSet;
          preview?: PreviewPayload;
        };
        if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
        if (data.action === "preview" && data.changeSet && data.preview) {
          if (draftTimer.current !== null) clearTimeout(draftTimer.current);
          setReceiptId(null);
          setToast(null);
          setDraft({ changeSet: data.changeSet, preview: data.preview });
          return;
        }
        if (data.action === "confirm_required" && data.pending) {
          setReceiptId(null);
          setPendingConfirm({ id: data.pending.id, message: data.pending.message });
          return;
        }
        const raw = data.message ?? data.reply ?? data.response ?? data.text ?? "";
        setReceiptId(data.actionId ?? null);
        setToastLink(data.taskDate ? { href: `/calendar?date=${data.taskDate}`, label: "View" } : data.projectId ? { href: `/projects/${data.projectId}`, label: "Open project" } : null);
        showToast(cleanReply(typeof raw === "string" ? raw : ""), !!data.actionId);
        await refresh();
        if (data.taskId) void generateQuestions(data.taskId, trimmed, data.quick === true).then(() => refresh());
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
        showToast(data.response ?? (confirm ? "Done." : "Cancelled."), confirm && !!data.actionId);
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
      if (action.kind === "recent") {
        closePalette();
        openRecentChanges();
        return;
      }
      if (action.kind === "event") {
        closePalette();
        window.dispatchEvent(new CustomEvent(action.value, { detail: action.eventDetail }));
        return;
      }
      if (action.kind === "navigate") {
        closePalette();
        router.push(action.value);
        return;
      }
      if (action.kind === "ask") {
        void submitAsk(action.value);
        return;
      }
      // prefill — keep the sheet open with the words in the box
      setSeed((s) => ({ key: s.key + 1, text: action.value, listen: false }));
    },
    [closePalette, router, submitAsk]
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
  // The capture home's mic island owns Space there (hold to talk).
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let holdTimer: number | null = null;
    let holding = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isFormField(e.target) || openRef.current || pathRef.current === "/") return;
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
          <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="Add or ask">
            <AddFlow
              key={seed.key}
              variant="sheet"
              autoFocus
              initialText={seed.text}
              listenOnOpen={seed.listen}
              onClose={closePalette}
              onTextChange={setValue}
            />
            {value.trim().length === 0 && (
              <div className="cmdk-list" aria-label="Suggestions">
                <p className="cmdk-section">From what Tangent knows</p>
                {QUICK_ACTIONS.map((action) => (
                  <button key={action.label} type="button" className="cmdk-item" onClick={() => runQuickAction(action)}>
                    <span className="cmdk-item-label">{action.label}</span>
                    {action.detail && <span className="cmdk-item-detail">{action.detail}</span>}
                  </button>
                ))}
              </div>
            )}
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

      {draft && !pendingConfirm && (
        <PreviewCard
          key={draft.changeSet.id}
          className="is-floating"
          changeSet={draft.changeSet}
          preview={draft.preview}
          onChanged={() => void refresh()}
          onSettled={onDraftSettled}
          autoFocus
          onJustChatting={() => {
            const asked = draft.changeSet.request_text;
            setDraft(null);
            void chatOnly([{ role: "user", content: asked }]).then((reply) => showToast(cleanReply(reply)));
          }}
        />
      )}

      {toast && !pendingConfirm && !draft && (
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
              {busy ? <span className="voice-pill-spinner" aria-hidden="true" /> : <Check size={18} strokeWidth={1.75} />} {toast}
            </span>
          )}
          {toastLink && !busy && (
            <Link href={toastLink.href} className="command-toast-link" onClick={() => setToast(null)}>
              {toastLink.label} →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
