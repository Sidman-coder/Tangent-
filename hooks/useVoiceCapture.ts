"use client";

// Single shared implementation of "record audio, upload it, get a transcript
// + handled response back." Used by VoiceRecordButton, CommandPalette's
// hold-space recorder, and the global VoiceCaptureFab — each owns its own UI
// status/toast handling via the onResult/onError callbacks, but there is
// exactly one MediaRecorder → webm → POST /api/voice-browser implementation.

import { useCallback, useRef, useState } from "react";

export type VoiceCaptureStatus = "idle" | "recording" | "uploading";

export type VoiceCaptureResult = {
  ok: boolean;
  response?: string;
  error?: string;
  action?: string;
  actionId?: string;
  pending?: { id: string; kind: string; message: string };
};

type UseVoiceCaptureOptions = {
  onResult?: (result: VoiceCaptureResult) => void | Promise<void>;
  onError?: (message: string) => void | Promise<void>;
};

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const { onResult, onError } = options;
  const [status, setStatus] = useState<VoiceCaptureStatus>("idle");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pressActiveRef = useRef(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setStatus("uploading");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch("/api/voice-browser", { method: "POST", body: formData });
        const data = (await res.json()) as VoiceCaptureResult;
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Voice command failed");
        }
        await onResult?.(data);
      } catch (e) {
        await onError?.(e instanceof Error ? e.message : "Voice command failed");
      } finally {
        setStatus("idle");
      }
    },
    [onResult, onError]
  );

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
      await onError?.(e instanceof Error ? e.message : "Microphone access denied");
      setStatus("idle");
    }
  }, [status, stopStream, uploadRecording, onError]);

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

  return { status, startRecording, stopRecording };
}
