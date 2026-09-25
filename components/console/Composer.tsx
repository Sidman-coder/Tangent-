"use client";

// The AI console's message box. A textarea that grows with its content
// (Enter sends, Shift+Enter adds a line), with the dictation mic and send
// button on a toolbar row underneath — the Notion / v0 composer layout.

import { useLayoutEffect, type ReactNode, type RefObject } from "react";
import { ArrowUp } from "lucide-react";
import VoiceRecordButton from "@/components/VoiceRecordButton";
import type { VoiceCaptureStatus } from "@/hooks/useVoiceCapture";
import type { ChatMode } from "@/components/console/turns";

const MAX_HEIGHT = 220;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  voiceStatus: VoiceCaptureStatus;
  onVoiceStatus: (status: VoiceCaptureStatus) => void;
  onTranscript: (text: string) => void;
  onVoiceError: (message: string) => void;
  /** Extra controls rendered on the left of the toolbar row. */
  toolbar?: ReactNode;
  placeholder?: string;
  /** Tints the box: Calendar mode gets the accent ring. */
  mode?: ChatMode;
};

export default function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  inputRef,
  voiceStatus,
  onVoiceStatus,
  onTranscript,
  onVoiceError,
  toolbar,
  placeholder,
  mode = "calendar",
}: Props) {
  const idlePlaceholder =
    placeholder ??
    (mode === "calendar"
      ? "Add or change something on your calendar…"
      : "Think a plan through — nothing is added until you say so…");
  // Grow to fit the text, then scroll inside the box past MAX_HEIGHT.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
      el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
    };
    fit();
    // Re-measure when the box changes width (first paint, sidebar toggles,
    // window resizes) so an early narrow measurement never sticks.
    let lastWidth = el.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (el.offsetWidth === lastWidth) return;
      lastWidth = el.offsetWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, inputRef]);

  const canSend = !busy && value.trim().length > 0 && voiceStatus === "idle";

  return (
    <form
      className={`tg-composer is-${mode} is-voice-${voiceStatus}${value.trim() ? " has-text" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        className="tg-composer-input"
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        placeholder={
          voiceStatus === "recording"
            ? "Listening… click the mic again to stop"
            : voiceStatus === "transcribing"
              ? "Transcribing…"
              : idlePlaceholder
        }
        aria-label="Message Tangent"
        disabled={busy}
        readOnly={voiceStatus === "transcribing"}
      />
      <div className="tg-composer-bar">
        <div className="tg-composer-tools">{toolbar}</div>
        <div className="tg-composer-actions">
          <VoiceRecordButton
            className="tg-icon-btn tg-mic"
            onTranscript={onTranscript}
            onError={onVoiceError}
            onStatusChange={onVoiceStatus}
            disabled={busy}
          />
          <button type="submit" className="tg-send" aria-label="Send" disabled={!canSend}>
            <ArrowUp size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </form>
  );
}
