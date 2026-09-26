"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { urgencyRgbVar } from "./urgency-palette";

// Split into its own chunk and requested only once the gates below pass.
const UrgencyOrbScene = dynamic(() => import("./UrgencyOrbScene"), { ssr: false, loading: () => null });

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Runs after the browser is idle, so the 3D chunk never competes with
 *  first paint or the data fetch for the main thread. */
// Let the dashboard's entrance stagger finish first; parsing the three.js
// chunk mid-animation stalls it.
const ENTRANCE_MS = 900;

function whenIdle(callback: () => void): () => void {
  let idleId: number | null = null;
  const timer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(callback, { timeout: 2000 });
    } else {
      callback();
    }
  }, ENTRANCE_MS);
  return () => {
    window.clearTimeout(timer);
    if (idleId !== null) window.cancelIdleCallback(idleId);
  };
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The urgency orb. A CSS-only orb always renders first (and is what
 * reduced-motion or no-WebGL users keep); the WebGL scene fades in over it
 * once loaded. Both read the same score, so color and intensity match.
 */
export default function UrgencyHero({ score }: { score: number }) {
  const reduceMotion = useReducedMotion();
  const [canLoad, setCanLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reduceMotion || failed) {
      setCanLoad(false);
      return;
    }
    return whenIdle(() => {
      if (supportsWebGL()) setCanLoad(true);
    });
  }, [reduceMotion, failed]);

  const show3D = canLoad && !failed && !reduceMotion;

  return (
    <div
      className={`urgency-orb${ready && show3D ? " is-3d" : ""}`}
      style={{ ["--orb-rgb" as string]: urgencyRgbVar(score), ["--orb-score" as string]: score.toFixed(3) }}
      aria-hidden="true"
    >
      <div className="urgency-orb-glow" />
      <div className="urgency-orb-static" />
      {show3D && (
        <SceneBoundary onError={() => setFailed(true)}>
          <UrgencyOrbScene score={score} onReady={() => setReady(true)} onFail={() => setFailed(true)} />
        </SceneBoundary>
      )}
    </div>
  );
}
