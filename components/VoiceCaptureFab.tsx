"use client";

// Persistent, cross-tab voice capture button — rendered once in AppShell so
// it's available on every page. Hold to record; on release the audio is
// transcribed and the text is handed to an editable input (never submitted):
// the AI console's composer when it's on screen, otherwise the command
// palette opens pre-filled. The student reviews it and presses Enter.

import { useCallback, useState } from "react";
import { Mic } from "lucide-react";
import { routeVoiceTranscript, useVoiceCapture } from "@/hooks/useVoiceCapture";

export default function VoiceCaptureFab() {
  const [toast, setToast] = useState<string | null>(null);

  const handleError = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const { status, startRecording, stopRecording } = useVoiceCapture({
    onTranscript: routeVoiceTranscript,
    onError: handleError,
  });

  const label =
    status === "recording" ? "Listening… release to stop" : status === "transcribing" ? "Transcribing…" : "Hold to talk to TANGENT";

  return (
    <>
      <button
        type="button"
        className={`voice-fab ${status === "transcribing" ? "uploading" : status}`}
        title={label}
        aria-label={label}
        disabled={status === "transcribing"}
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
        ) : status === "transcribing" ? (
          <span className="voice-fab-spinner" />
        ) : (
          <Mic size={20} strokeWidth={1.8} aria-hidden="true" />
        )}
      </button>

      {status !== "idle" && (
        <div className="voice-pill" role="status">
          {status === "recording" ? (
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

      {toast && (
        <div className="command-toast" role="status" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </>
  );
}
