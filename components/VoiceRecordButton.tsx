"use client";

// Composer mic for the AI console. Click to start, click again to stop (the
// Claude/Gemini pattern). The transcript is handed to the parent through
// onTranscript so it lands in the editable composer — nothing is submitted.

import { useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useVoiceCapture, type VoiceCaptureStatus } from "@/hooks/useVoiceCapture";

type Props = {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: VoiceCaptureStatus) => void;
  disabled?: boolean;
  className?: string;
};

export default function VoiceRecordButton({ onTranscript, onError, onStatusChange, disabled, className }: Props) {
  const { status, startRecording, stopRecording } = useVoiceCapture({ onTranscript, onError });

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const label = status === "recording" ? "Stop recording" : status === "transcribing" ? "Transcribing…" : "Dictate";

  return (
    <button
      type="button"
      className={`${className ?? "voice-record-btn"} is-${status}`}
      aria-label={label}
      title={label}
      aria-pressed={status === "recording"}
      disabled={disabled || status === "transcribing"}
      onClick={() => (status === "recording" ? stopRecording() : void startRecording())}
    >
      {status === "recording" ? (
        <Square size={13} strokeWidth={0} fill="currentColor" aria-hidden="true" />
      ) : status === "transcribing" ? (
        <span className="voice-pill-spinner" aria-hidden="true" />
      ) : (
        <Mic size={17} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
