"use client";

// The AI console's message box. A textarea that grows with its content
// (Enter sends, Shift+Enter adds a line), with the dictation mic and send
// button on a toolbar row underneath — the Notion / v0 composer layout.

import { useId, useLayoutEffect, type ReactNode, type RefObject } from "react";
import { ArrowUp, Square } from "lucide-react";
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
  /** Master fix Phase 4: while busy, Send becomes Stop. */
  onStop?: () => void;
  /** Form field name (each field has an id or name). */
  name?: string;
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
  onStop,
  name = "message",
}: Props) {
  const inputId = `composer${useId().replace(/:/g, "")}`;
  const idlePlaceholder =
    placeholder ??
    (mode === "calendar"
      ? "Add or change something on your calendar…"
      : "Think a plan through…");
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
      className={`ui-composer is-${mode} is-voice-${voiceStatus}${value.trim() ? " has-text" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor={inputId} className="ui-visually-hidden">
        Message Tangent
      </label>
      <textarea
        ref={inputRef}
        id={inputId}
        name={name}
        className="ui-composer-input"
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
        disabled={busy}
        readOnly={voiceStatus === "transcribing"}
      />
      <div className="ui-composer-bar">
        <div className="ui-composer-tools">{toolbar}</div>
        <div className="ui-composer-actions">
          <VoiceRecordButton
            className="ui-icon-button ui-icon-button--ghost ui-composer-mic"
            onTranscript={onTranscript}
            onError={onVoiceError}
            onStatusChange={onVoiceStatus}
            disabled={busy}
          />
          {busy && onStop ? (
            <button
              type="button"
              className="ui-icon-button ui-icon-button--filled ui-composer-send is-stop"
              aria-label="Stop"
              data-tooltip="Stop (Esc)"
              onClick={onStop}
            >
              <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              className="ui-icon-button ui-icon-button--filled ui-composer-send"
              aria-label="Send"
              data-tooltip="Send"
              disabled={!canSend}
            >
              <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
