"use client";

// A display-only live caption from the browser's own speech recognition
// (Chrome, desktop Safari), for while the mic is held and the streamed
// transcript isn't arriving. Never used to save anything; lib/live-caption.ts
// decides when it may run and which text wins.

import { useEffect, useState } from "react";
import { browserCaptionAllowed } from "@/lib/live-caption";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function makeRecognition(): Recognition | null {
  if (typeof window === "undefined" || !browserCaptionAllowed(navigator)) return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useBrowserCaption(active: boolean): string {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active) {
      setText("");
      return;
    }
    const rec = makeRecognition();
    if (!rec) return;
    let live = true;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0]?.transcript ?? "");
      setText(parts.join(" ").replace(/\s+/g, " ").trim());
    };
    rec.onerror = () => {
      live = false;
    };
    // Chrome ends recognition after a pause; keep it going while still held.
    rec.onend = () => {
      if (!live) return;
      try {
        rec.start();
      } catch {
        live = false;
      }
    };
    try {
      rec.start();
    } catch {
      return;
    }
    return () => {
      live = false;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [active]);

  return text;
}
