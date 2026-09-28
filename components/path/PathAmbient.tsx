"use client";

import { useEffect, useRef } from "react";

// The layer under the geometry: slow light and drifting dust.
//
// Its whole job is depth. Without it the tree reads as a diagram on a flat
// panel; with it the circles sit in something. It is deliberately unaware of
// the tree - it reads the camera each frame so the dust parallaxes against the
// geometry, and nothing else.
//
// Never touches React state: the loop reads the camera ref directly, so it costs
// no renders. Under reduced motion it paints one static frame and stops.

type Props = {
  /** Reads the camera without subscribing, so this costs no renders. */
  read: () => { x: number; y: number; scale: number };
  reduced: boolean;
};

type Mote = { x: number; y: number; r: number; drift: number; alpha: number };

const MOTE_COUNT = 90;

export default function PathAmbient({ read, reduced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let frame = 0;
    let running = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      motes = Array.from({ length: MOTE_COUNT }, () => ({
        x: Math.random() * 2400 - 1200,
        y: Math.random() * 2400 - 1200,
        r: 0.4 + Math.random() * 1.5,
        drift: 0.15 + Math.random() * 0.5,
        alpha: 0.12 + Math.random() * 0.4,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      if (!width || !height) return;
      const { x: camX, y: camY, scale: s } = read();

      ctx.clearRect(0, 0, width, height);

      // Two slow lights, drifting out of phase. The tree sits in front of them.
      const glow = (cx: number, cy: number, radius: number, color: string, alpha: number) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, color.replace("ALPHA", String(alpha)));
        g.addColorStop(1, color.replace("ALPHA", "0"));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      };

      const phase = reduced ? 0 : t * 0.00006;
      glow(
        width * (0.34 + Math.sin(phase) * 0.06),
        height * (0.3 + Math.cos(phase * 0.8) * 0.05),
        Math.max(width, height) * 0.62,
        "rgba(126, 104, 210, ALPHA)",
        0.2
      );
      glow(
        width * (0.72 + Math.cos(phase * 1.2) * 0.05),
        height * (0.7 + Math.sin(phase) * 0.06),
        Math.max(width, height) * 0.5,
        "rgba(48, 152, 128, ALPHA)",
        0.13
      );

      // Dust, parallaxed at a fraction of the camera so it reads as further away.
      const parallax = 0.45;
      ctx.fillStyle = "#ffffff";
      for (const mote of motes) {
        const wander = reduced ? 0 : Math.sin(t * 0.0002 * mote.drift + mote.x) * 6;
        const sx = width / 2 + (mote.x - camX * parallax) * s * 0.6 + wander;
        const sy = height / 2 + (mote.y - camY * parallax) * s * 0.6;
        if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
        ctx.globalAlpha = mote.alpha * Math.min(1, s * 1.4);
        ctx.beginPath();
        ctx.arc(sx, sy, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      if (!running) return;
      draw(t);
      frame = requestAnimationFrame(loop);
    };

    const observer = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    observer.observe(canvas);

    seed();
    resize();

    if (reduced) {
      draw(0);
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [read, reduced]);

  return <canvas ref={canvasRef} className="path-ambient" aria-hidden="true" />;
}
