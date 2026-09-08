"use client";

import { useCallback, useRef, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";

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
  const [status, setStatus] = useState<Status>("idle");
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pressActiveRef = useRef(false);

  const resetSoon = useCallback((delayMs: number) => {
    window.setTimeout(() => setStatus("idle"), delayMs);
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setStatus("uploading");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch("/api/voice-browser", { method: "POST", body: formData });
        const data = (await res.json()) as { ok: boolean; response?: string; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Voice command failed");
        }
        setLastResponse(data.response ?? "Done!");
        setStatus("success");
        void refresh();
      } catch (e) {
        setLastResponse(e instanceof Error ? e.message : "Voice command failed");
        setStatus("error");
      } finally {
        resetSoon(2500);
      }
    },
    [refresh, resetSoon]
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "uploading") return;
    pressActiveRef.current = true;
    try {
      // Mic permission is requested here, on first press, not on page load.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!pressActiveRef.current) {
        // The user already released before permission resolved — don't start recording.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          void uploadRecording(blob);
        } else {
          setStatus("idle");
        }
      };

      recorder.start();
      setStatus("recording");
    } catch (e) {
      pressActiveRef.current = false;
      setLastResponse(e instanceof Error ? e.message : "Microphone access denied");
      setStatus("error");
      resetSoon(2500);
    }
  }, [status, stopStream, uploadRecording, resetSoon]);

  const stopRecording = useCallback(() => {
    pressActiveRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else if (status === "recording") {
      stopStream();
      setStatus("idle");
    }
  }, [status, stopStream]);

  const disabled = status === "uploading";

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
          if (status === "recording") stopRecording();
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
