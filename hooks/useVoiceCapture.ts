"use client";

// Single shared implementation of "record audio, get a transcript back." Used by
// VoiceRecordButton (AI console composer), CommandPalette's hold-space recorder,
// and the Today capture dock. Callers decide what a transcript does: the
// composer and palette put it in an editable input; the capture dock sends it
// straight to the pipeline and offers Undo.
//
// With `live: true` the audio is also streamed to Deepgram while recording, so
// words appear as the student speaks and the transcript is ready the moment
// they stop (no upload wait). If the live socket can't open or returns nothing,
// the same recording is uploaded to /api/voice-browser instead — live is a
// speed-up, never a requirement.

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceCaptureStatus = "idle" | "recording" | "transcribing";

type UseVoiceCaptureOptions = {
  onTranscript?: (text: string) => void | Promise<void>;
  onError?: (message: string) => void | Promise<void>;
  /** Stream to Deepgram while recording (needs /api/voice-token). */
  live?: boolean;
  /** Running transcript while recording, live mode only. */
  onPartial?: (text: string) => void;
  /** Keep the mic open between recordings (released after KEEP_STREAM_MS
   *  unused, or on unmount). Each fresh getUserMedia can re-prompt for
   *  permission (Safari does), so a screen made for repeated captures holds it. */
  keepStream?: boolean;
};

const KEEP_STREAM_MS = 60_000;

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

const LIVE_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true";
/** How long to wait for Deepgram's last words after the student stops. */
const LIVE_FINISH_MS = 1500;
/** Chunk size while streaming; small enough that words keep up with speech. */
const LIVE_SLICE_MS = 250;

// Safari records mp4, not webm. Hard-coding webm throws there.
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

async function fetchLiveToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/voice-token", { method: "POST" });
    const data = (await res.json()) as { ok?: boolean; token?: string };
    return res.ok && data.ok && data.token ? data.token : null;
  } catch {
    return null;
  }
}

export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const { onTranscript, onError, live = false, onPartial, keepStream = false } = options;
  const [status, setStatus] = useState<VoiceCaptureStatus>("idle");

  // Callbacks change identity every render; the recorder's event handlers are
  // created once per recording, so they read the latest ones through a ref.
  const cb = useRef({ onTranscript, onError, onPartial });
  cb.current = { onTranscript, onError, onPartial };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressActiveRef = useRef(false);
  const cancelledRef = useRef(false);

  // Live socket state for the current recording.
  const socketRef = useRef<WebSocket | null>(null);
  const sentRef = useRef(0);
  const finalsRef = useRef<string[]>([]);
  const interimRef = useRef("");

  // Input level for a meter, read by the caller on its own animation frame.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const idleTimerRef = useRef<number | null>(null);
  const teardown = useCallback(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  // After a recording: let the mic go, or (keepStream) keep it warm for the
  // next press and let it go only once it has sat unused.
  const release = useCallback(() => {
    if (!keepStream || !streamRef.current) {
      teardown();
      return;
    }
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(teardown, KEEP_STREAM_MS);
  }, [keepStream, teardown]);

  const closeSocket = useCallback(() => {
    const ws = socketRef.current;
    socketRef.current = null;
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
  }, []);

  /** 0..1 loudness of the mic right now; 0 when not recording. */
  const getLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 4);
  }, []);

  const deliver = useCallback(async (text: string) => {
    try {
      await cb.current.onTranscript?.(text);
    } finally {
      setStatus("idle");
    }
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setStatus("transcribing");
      try {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        const formData = new FormData();
        formData.append("audio", blob, `recording.${ext}`);
        formData.append("mode", "transcribe");
        const res = await fetch("/api/voice-browser", { method: "POST", body: formData });
        const data = (await res.json()) as { ok?: boolean; text?: string; error?: string };
        if (!res.ok || !data.ok || !data.text) {
          throw new Error(data.error || "Couldn't catch that — try again.");
        }
        await deliver(data.text);
      } catch (e) {
        await cb.current.onError?.(e instanceof Error ? e.message : "Couldn't catch that — try again.");
        setStatus("idle");
      }
    },
    [deliver]
  );

  /** Ends the live stream and resolves with whatever Deepgram finalised. */
  const finishLive = useCallback((): Promise<string> => {
    const ws = socketRef.current;
    const collected = () => [...finalsRef.current, interimRef.current].join(" ").replace(/\s+/g, " ").trim();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      closeSocket();
      return Promise.resolve("");
    }
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        socketRef.current = null;
        resolve(collected());
      };
      const timer = window.setTimeout(() => {
        ws.close();
        done();
      }, LIVE_FINISH_MS);
      ws.addEventListener("close", done, { once: true });
      // Flush anything recorded since the last send, then ask Deepgram to
      // finalise and close; it sends the remaining results before closing.
      chunksRef.current.slice(sentRef.current).forEach((c) => ws.send(c));
      sentRef.current = chunksRef.current.length;
      ws.send(JSON.stringify({ type: "CloseStream" }));
    });
  }, [closeSocket]);

  const openLive = useCallback((token: string) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(LIVE_URL, ["bearer", token]);
    } catch {
      return;
    }
    socketRef.current = ws;
    ws.onopen = () => {
      // The first chunk carries the container header, so everything recorded
      // while the socket was connecting goes first, in order.
      chunksRef.current.slice(sentRef.current).forEach((c) => ws.send(c));
      sentRef.current = chunksRef.current.length;
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          is_final?: boolean;
          channel?: { alternatives?: { transcript?: string }[] };
        };
        if (msg.type !== "Results") return;
        const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
        if (msg.is_final) {
          if (text) finalsRef.current.push(text);
          interimRef.current = "";
        } else {
          interimRef.current = text;
        }
        cb.current.onPartial?.([...finalsRef.current, interimRef.current].join(" ").trim());
      } catch {
        // Non-JSON or metadata frames carry no words.
      }
    };
    ws.onerror = () => {
      // Recording carries on; stop falls back to the upload path.
      if (socketRef.current === ws) socketRef.current = null;
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (status !== "idle" || pressActiveRef.current) return;
    pressActiveRef.current = true;
    cancelledRef.current = false;
    finalsRef.current = [];
    interimRef.current = "";
    sentRef.current = 0;
    chunksRef.current = [];

    // Ask for the token while the mic spins up, not after.
    const tokenPromise = live ? fetchLiveToken() : Promise.resolve(null);

    try {
      // Mic permission is requested here, on first press, not on page load.
      // A warm stream (keepStream) is reused, so it isn't asked again.
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      const warm = streamRef.current?.getAudioTracks().some((t) => t.readyState === "live") ? streamRef.current : null;
      const stream =
        warm ??
        (await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }));
      if (!pressActiveRef.current) {
        // Released or cancelled before permission resolved — don't record.
        if (stream === warm) release();
        else stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      if (!warm || !analyserRef.current) try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        // The meter is decoration; recording works without it.
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        chunksRef.current.push(e.data);
        const ws = socketRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
          sentRef.current = chunksRef.current.length;
        }
      };
      recorder.onstop = () => {
        release();
        mediaRecorderRef.current = null;
        if (cancelledRef.current) {
          closeSocket();
          setStatus("idle");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setStatus("transcribing");
        void finishLive().then((text) => {
          if (text) void deliver(text);
          else if (blob.size > 0) void uploadRecording(blob);
          else setStatus("idle");
        });
      };

      recorder.start(live ? LIVE_SLICE_MS : undefined);
      setStatus("recording");

      void tokenPromise.then((token) => {
        if (token && mediaRecorderRef.current === recorder) openLive(token);
      });
    } catch (e) {
      pressActiveRef.current = false;
      teardown();
      await cb.current.onError?.(e instanceof Error ? e.message : "Microphone access denied");
      setStatus("idle");
    }
  }, [status, live, teardown, release, closeSocket, finishLive, deliver, uploadRecording, openLive]);

  const stopRecording = useCallback(() => {
    pressActiveRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else if (status === "recording") {
      release();
      setStatus("idle");
    }
  }, [status, release]);

  /** Stop and throw the recording away (Escape). */
  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    stopRecording();
  }, [stopRecording]);

  // Leaving the page mid-recording must release the mic.
  useEffect(
    () => () => {
      cancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      closeSocket();
      teardown();
    },
    [closeSocket, teardown]
  );

  return { status, startRecording, stopRecording, cancelRecording, getLevel };
}
