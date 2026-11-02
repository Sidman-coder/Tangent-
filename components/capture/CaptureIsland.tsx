"use client";

// The mic: one frosted glass island at the bottom of the capture home, and the
// whole island is the button. Presses go through lib/hold-gesture.ts; this
// file only turns pointer/keyboard input into HoldEvents and draws the state.

import { forwardRef, useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { Mic } from "lucide-react";
import type { HoldEvent, HoldState } from "@/lib/hold-gesture";

const BARS = 9;

type Props = {
  state: HoldState;
  /** 0..1 mic loudness (useVoiceCapture's getLevel). */
  level: () => number;
  /** The last thing heard, shown small while sorting. */
  transcriptTail: string;
  /** Listening began without a press (?capture=1): the next tap sends. */
  tapToStop: boolean;
  onEvent: (e: HoldEvent) => void;
};

const CaptureIsland = forwardRef<HTMLButtonElement, Props>(function CaptureIsland({ state, level, transcriptTail, tapToStop, onEvent }, ref) {
  const reduced = useReducedMotion();
  const bars = useRef<HTMLSpanElement[]>([]);
  const listening = state === "listening";
  const sorting = state === "sorting";

  // The waveform is drawn straight onto the bars each frame (never state):
  // the real mic level, carried on a slow wave so silence still breathes.
  useEffect(() => {
    if (!listening) {
      bars.current.forEach((b) => b && (b.style.transform = "scaleY(0.2)"));
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const l = level();
      bars.current.forEach((b, i) => {
        if (!b) return;
        const wave = Math.abs(Math.sin(t * 6 + i * 0.8) * Math.sin(t * 2.3 + i * 1.7));
        b.style.transform = `scaleY(${Math.min(1, 0.18 + wave * (0.25 + l * 1.4))})`;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [listening, level]);

  const label = sorting ? "Sorting…" : listening ? (tapToStop ? "Tap to add" : "Let go to add") : "Hold to talk";
  const swell = listening && !reduced;

  return (
    <div className="capture-dock">
      {sorting && transcriptTail && <p className="capture-tail">“{transcriptTail}”</p>}
      <div className={`capture-island-wrap${listening ? " is-listening" : ""}${sorting ? " is-sorting" : ""}`}>
      <m.button
        ref={ref}
        type="button"
        className={`capture-island${listening ? " is-listening" : ""}${sorting ? " is-sorting" : ""}`}
        aria-label={listening ? label : "Hold to talk, or tap to type"}
        aria-pressed={listening}
        aria-busy={sorting}
        // The swell is a transform (compositor-only). Animating height re-laid
        // out the page and re-ran the glass blur every frame: that was the lag.
        animate={reduced ? {} : { scale: swell ? 1.045 : 1, y: swell ? -6 : 0 }}
        whileTap={reduced || sorting || listening ? undefined : { scale: 0.965 }}
        transition={{ type: "spring", visualDuration: 0.45, bounce: 0.3 }}
        onPointerDown={(e) => {
          // Capture can be refused (a pointer the browser no longer tracks); the press still counts.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* released or synthetic pointer */
          }
          onEvent({ type: "down", t: performance.now(), y: e.clientY });
        }}
        onPointerUp={(e) => onEvent({ type: "up", t: performance.now(), y: e.clientY })}
        onPointerCancel={() => onEvent({ type: "cancel" })}
        onLostPointerCapture={() => onEvent({ type: "cancel" })}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="capture-glow" aria-hidden="true" />
        <span className="capture-shimmer" aria-hidden="true" />
        <Mic className="capture-mic" size={30} strokeWidth={2.4} aria-hidden="true" />
        <span className="capture-label" aria-hidden="true">
          <m.span key={label} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ type: "spring", visualDuration: 0.35, bounce: 0.2 }}>
            {label}
          </m.span>
        </span>
        <span className="capture-wave" aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} ref={(el) => { if (el) bars.current[i] = el; }} />
          ))}
        </span>
      </m.button>
      </div>
      <p className="capture-type-hint" aria-hidden="true">or tap to type</p>
    </div>
  );
});

export default CaptureIsland;
