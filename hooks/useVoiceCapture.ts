"use client";

// Single shared implementation of "record audio, upload it, get a transcript
// back." Used by VoiceRecordButton (AI console composer), CommandPalette's
// hold-space recorder, and the global VoiceCaptureFab. Browser voice never
// submits anything on its own: every caller receives the transcript through
// onTranscript and places it in an editable input, and the student presses
// Enter/Send themselves after correcting any mishearings.

import { useCallback, useRef, useState } from "react";

export type VoiceCaptureStatus = "idle" | "recording" | "transcribing";

type UseVoiceCaptureOptions = {
  onTranscript?: (text: string) => void | Promise<void>;
  onError?: (message: string) => void | Promise<void>;
};

/** Event the global voice button fires with a finished transcript. A mounted
 *  text surface (the AI console) can claim it with preventDefault(); if nothing
 *  claims it, the command palette opens pre-filled instead. */
export const VOICE_TRANSCRIPT_EVENT = "tangent:voice-transcript";
export type VoiceTranscriptDetail = { text: string };

/** Event that opens the command palette, optionally pre-filled. */
export const OPEN_PALETTE_EVENT = "tangent:open-palette";
export type OpenPaletteDetail = { prefill?: string } | undefined;

export function routeVoiceTranscript(text: string) {
  const claimed = !window.dispatchEvent(
    new CustomEvent<VoiceTranscriptDetail>(VOICE_TRANSCRIPT_EVENT, { detail: { text }, cancelable: true })
  );
  if (!claimed) {
    window.dispatchEvent(new CustomEvent<OpenPaletteDetail>(OPEN_PALETTE_EVENT, { detail: { prefill: text } }));
  }
}

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const { onTranscript, onError } = options;
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
      setStatus("transcribing");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        formData.append("mode", "transcribe");
        const res = await fetch("/api/voice-browser", { method: "POST", body: formData });
        const data = (await res.json()) as { ok?: boolean; text?: string; error?: string };
        if (!res.ok || !data.ok || !data.text) {
          throw new Error(data.error || "Couldn't transcribe that — try again.");
        }
        await onTranscript?.(data.text);
      } catch (e) {
        await onError?.(e instanceof Error ? e.message : "Couldn't transcribe that — try again.");
      } finally {
        setStatus("idle");
      }
    },
    [onTranscript, onError]
  );

  const startRecording = useCallback(async () => {
    if (status === "recording" || status === "transcribing") return;
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
