"use client";

// The AI console's message box. A textarea that grows with its content
// (Enter sends, Shift+Enter adds a line), with the dictation mic and send
// button on a toolbar row underneath — the Notion / v0 composer layout.

import { useLayoutEffect, type ReactNode, type RefObject } from "react";
import { ArrowUp } from "lucide-react";
import VoiceRecordButton from "@/components/VoiceRecordButton";
import type { VoiceCaptureStatus } from "@/hooks/useVoiceCapture";

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
  placeholder = "Ask about your schedule or make a change…",
}: Props) {
  // Grow to fit the text, then scroll inside the box past MAX_HEIGHT.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value, inputRef]);

  const canSend = !busy && value.trim().length > 0 && voiceStatus === "idle";

  return (
    <form
      className={`tg-composer is-voice-${voiceStatus}`}
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
              : placeholder
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
