"use client";

// Instant capture on Today: one button, bottom centre. Press and talk.
// - Tap to start, tap again to stop. Or press and hold, and let go to stop.
// - Words stream in while you speak (live mode in useVoiceCapture).
// - The moment you stop, the text goes straight to the pipeline (/api/chat,
//   calendar mode) — no review step. The result shows in the same dock with
//   Undo, which is the guard against mishearings. Anything destructive still
//   comes back as confirm_required and asks first.
// - Escape throws a recording away.
// The dock is one surface that changes shape, so the result appears where the
// student was looking when they spoke, and it shrinks back into the button.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, Mic, Square, X } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import { useAppState } from "@/components/AppStateProvider";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import "./capture-dock.css";

type Phase =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "saving"; text: string }
  | { kind: "done"; text: string; actionId: string | null }
  | { kind: "confirm"; id: string; message: string }
  | { kind: "error"; message: string };

type ChatReply = {
  ok?: boolean;
  message?: string;
  response?: string;
  error?: string;
  action?: string;
  actionId?: string;
  pending?: { id: string; message: string };
};

/** Held longer than this, the press is push-to-talk: letting go stops. */
const HOLD_MS = 350;
const DONE_MS = 6000;
const ERROR_MS = 4000;

// Critically damped: the dock reshapes without overshoot (Apple's default for
// UI that wasn't thrown). Content inside crossfades on its own short clock.
const DOCK_SPRING = { type: "spring", visualDuration: 0.36, bounce: 0 } as const;
const SWAP = {
  initial: { opacity: 0, filter: "blur(3px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, filter: "blur(3px)", transition: { duration: 0.1 } },
} as const;

function readable(raw: string | undefined): string {
  const text = (raw ?? "").replace(/```[\s\S]*?```/g, "").trim();
  if (!text || text.startsWith("{")) return "Saved.";
  return text;
}

export default function CaptureDock() {
  const router = useRouter();
  const { refresh } = useAppState();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [partial, setPartial] = useState("");
  const pressAt = useRef(0);
  const autoStart = useRef(false);
  const meterRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const send = useCallback(
    async (text: string) => {
      setPhase({ kind: "saving", text });
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
        });
        const data = (await res.json()) as ChatReply;
        if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't save that.");
        if (data.action === "confirm_required" && data.pending) {
          setPhase({ kind: "confirm", id: data.pending.id, message: data.pending.message });
          return;
        }
        setPhase({ kind: "done", text: readable(data.message ?? data.response), actionId: data.actionId ?? null });
        void refresh();
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save that." });
      }
    },
    [refresh]
  );

  const { status, startRecording, stopRecording, cancelRecording, getLevel } = useVoiceCapture({
    live: true,
    onPartial: setPartial,
    onTranscript: send,
    onError: (message) => {
      // An auto-start from the home-screen shortcut can be refused for want
      // of a tap (iOS). Stay quietly ready instead of greeting with an error.
      if (autoStart.current) {
        autoStart.current = false;
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "error", message });
    },
  });

  const begin = useCallback(() => {
    setPartial("");
    setPhase({ kind: "recording" });
    if ("vibrate" in navigator) navigator.vibrate?.(8);
    void startRecording();
  }, [startRecording]);

  // The recorder can end without us asking (mic error, permission revoked).
  useEffect(() => {
    if (status === "idle" && phase.kind === "recording") setPhase({ kind: "idle" });
  }, [status, phase.kind]);

  // Results and errors fold back into the button on their own.
  useEffect(() => {
    if (phase.kind !== "done" && phase.kind !== "error") return;
    const id = window.setTimeout(() => setPhase({ kind: "idle" }), phase.kind === "done" ? DONE_MS : ERROR_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // Home-screen shortcut: /?capture=1 opens straight into listening.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture") !== "1") return;
    autoStart.current = true;
    router.replace("/", { scroll: false });
    begin();
    // Once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape discards a recording, or dismisses a result early.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (status === "recording") {
        cancelRecording();
        setPhase({ kind: "idle" });
      } else if (phase.kind === "done" || phase.kind === "error") {
        setPhase({ kind: "idle" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, phase.kind, cancelRecording]);

  // Level meter: read the analyser on every frame and write transforms
  // directly — no React state at 60fps.
  useEffect(() => {
    if (status !== "recording") return;
    let raf = 0;
    const smooth = [0, 0, 0, 0, 0];
    const shape = [0.55, 0.85, 1, 0.8, 0.6];
    const tick = () => {
      const level = getLevel();
      const bars = meterRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          smooth[i] += (level * shape[i] - smooth[i]) * 0.35;
          (bars[i] as HTMLElement).style.transform = `scaleY(${0.18 + smooth[i] * 0.82})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, getLevel]);

  // Respond on press, not release. Holding past HOLD_MS turns the press into
  // push-to-talk, so the release stops it; a quick tap leaves it listening.
  const onMicPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || status !== "idle") return;
    pressAt.current = performance.now();
    begin();
    const onUp = () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (performance.now() - pressAt.current > HOLD_MS) stopRecording();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Keyboard activation (Enter/Space) arrives as a click with detail 0.
  const onMicClick = (e: React.MouseEvent) => {
    if (e.detail === 0 && status === "idle") begin();
  };

  const resolveConfirm = async (id: string, confirm: boolean) => {
    setPhase({ kind: "saving", text: confirm ? "Confirming…" : "Cancelling…" });
    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirm }),
      });
      const data = (await res.json()) as ChatReply;
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't do that.");
      setPhase({
        kind: "done",
        text: readable(data.response) || (confirm ? "Done." : "Cancelled."),
        actionId: confirm ? data.actionId ?? null : null,
      });
      void refresh();
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't do that." });
    }
  };

  const listening = phase.kind === "recording";
  const finishing = listening && status === "transcribing";

  if (!mounted) return null;

  // Portalled to <body>: the page's entrance animation transforms its
  // ancestors, which would pin a fixed element to them instead of the viewport.
  return createPortal(
    <div className="capture-dock-wrap">
      <m.div
        layout
        transition={DOCK_SPRING}
        style={{ borderRadius: 999 }}
        className={`capture-dock is-${phase.kind}`}
        role={phase.kind === "idle" ? undefined : "status"}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {phase.kind === "idle" && (
            <m.button
              key="mic"
              {...SWAP}
              type="button"
              className="capture-mic"
              aria-label="Capture — tap and speak"
              title="Tap and speak"
              onPointerDown={onMicPointerDown}
              onClick={onMicClick}
            >
              <Mic size={22} strokeWidth={2} aria-hidden="true" />
            </m.button>
          )}

          {listening && (
            <m.div key="listening" {...SWAP} className="capture-row">
              <span className="capture-meter" ref={meterRef} aria-hidden="true">
                <i /><i /><i /><i /><i />
              </span>
              <span className={`capture-words${partial ? "" : " is-placeholder"}`}>
                <span>{partial || "Listening…"}</span>
              </span>
              <button
                type="button"
                className="capture-icon-btn"
                onClick={() => {
                  cancelRecording();
                  setPhase({ kind: "idle" });
                }}
                aria-label="Discard"
                disabled={finishing}
              >
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="capture-stop"
                onClick={stopRecording}
                aria-label="Stop and save"
                disabled={finishing}
              >
                {finishing ? (
                  <span className="capture-spinner" aria-hidden="true" />
                ) : (
                  <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
                )}
              </button>
            </m.div>
          )}

          {phase.kind === "saving" && (
            <m.div key="saving" {...SWAP} className="capture-row">
              <span className="capture-spinner is-quiet" aria-hidden="true" />
              <span className="capture-words">
                <span>{phase.text}</span>
              </span>
            </m.div>
          )}

          {phase.kind === "done" && (
            <m.div key="done" {...SWAP} className="capture-row">
              <span className="capture-check" aria-hidden="true">
                <Check size={14} strokeWidth={2.4} />
              </span>
              {phase.actionId ? (
                <ActionReceipt
                  actionId={phase.actionId}
                  label={phase.text}
                  onUndone={() => void refresh()}
                />
              ) : (
                <span className="capture-message">{phase.text}</span>
              )}
            </m.div>
          )}

          {phase.kind === "confirm" && (
            <m.div key="confirm" {...SWAP} className="capture-row">
              <span className="capture-message">{phase.message}</span>
              <button type="button" className="capture-text-btn" onClick={() => void resolveConfirm(phase.id, false)}>
                Cancel
              </button>
              <button
                type="button"
                className="capture-text-btn is-primary"
                onClick={() => void resolveConfirm(phase.id, true)}
              >
                Confirm
              </button>
            </m.div>
          )}

          {phase.kind === "error" && (
            <m.div key="error" {...SWAP} className="capture-row">
              <span className="capture-message is-error">{phase.message}</span>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </div>,
    document.body
  );
}
