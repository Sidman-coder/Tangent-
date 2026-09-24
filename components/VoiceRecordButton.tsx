"use client";

import { useCallback, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import { useVoiceCapture, type VoiceCaptureResult } from "@/hooks/useVoiceCapture";

type Status = "idle" | "recording" | "uploading" | "success" | "error";

const LABELS: Record<Status, string> = {
  idle: "Hold to talk",
  recording: "Listening…",
  uploading: "Thinking…",
  success: "Done!",
  error: "Try again",
};

export default function VoiceRecordButton() {
  const { refresh } = useAppState();
  const [settledStatus, setSettledStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const resetSoon = useCallback((delayMs: number) => {
    window.setTimeout(() => setSettledStatus("idle"), delayMs);
  }, []);

  const handleResult = useCallback(
    async (result: VoiceCaptureResult) => {
      setLastResponse(result.response ?? "Done!");
      setSettledStatus("success");
      await refresh();
      resetSoon(2500);
    },
    [refresh, resetSoon]
  );

  const handleError = useCallback(
    (message: string) => {
      setLastResponse(message);
      setSettledStatus("error");
      resetSoon(2500);
    },
    [resetSoon]
  );

  const { status: captureStatus, startRecording, stopRecording } = useVoiceCapture({
    onResult: handleResult,
    onError: handleError,
  });

  // Capture status (recording/uploading) takes priority while active; once it
  // settles back to idle, show whatever the last result was for a couple seconds.
  const status: Status = captureStatus === "idle" ? settledStatus : captureStatus;
  const disabled = captureStatus === "uploading";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
      <button
        type="button"
        className={`voice-record-btn ${status}`}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onMouseUp={stopRecording}
        onMouseLeave={() => {
          if (captureStatus === "recording") stopRecording();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onTouchEnd={stopRecording}
        onTouchCancel={stopRecording}
      >
        {status === "recording" && <span className="voice-dot" />}
        {status === "uploading" && <span className="voice-spinner" />}
        {LABELS[status]}
      </button>
      {(status === "success" || status === "error") && lastResponse && (
        <span style={{ fontSize: "0.8rem", color: "var(--muted)", maxWidth: 260, textAlign: "center" }}>
          {lastResponse}
        </span>
      )}
    </div>
  );
}
