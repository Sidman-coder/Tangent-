"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// The camera over the Path world.
//
// Deliberately not built on React state or on Motion's values:
//
// - React state is wrong because a drag updates the camera on every pointer
//   frame, and re-rendering the whole tree that often collapses on a phone.
// - Motion values were tried first and, under this app's LazyMotion setup, only
//   reached the DOM when React happened to re-render, so panning and zooming
//   silently did nothing between renders.
//
// So the camera owns a ref, integrates its own spring, and writes two things per
// frame: a transform on the world layer, and a `--path-zoom` custom property on
// the stage. Labels counter-scale off that variable in CSS, so there are no
// per-node subscriptions at all: one property write resizes every label.
//
// World coordinates come from lib/path-layout.ts and map 1:1 to CSS pixels, so a
// node at world (120, -40) sits at CSS (120px, -40px) inside the world layer.

export type Vec = { x: number; y: number };

const MIN_SCALE = 0.18;
const MAX_SCALE = 2.6;

/** Spring constants. Slightly underdamped, so a move arrives with a little
 *  weight instead of sliding to a stop. */
const STIFFNESS = 150;
const DAMPING = 22;
/** Below this the spring has arrived and the loop stops. */
const REST = 0.01;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

type Cam = { x: number; y: number; scale: number };

export type PathCamera = {
  stageRef: React.RefObject<HTMLDivElement>;
  worldRef: React.RefObject<HTMLDivElement>;
  size: { width: number; height: number };
  isDragging: boolean;
  /** Current camera, read without subscribing. Used by the ambient layer. */
  read: () => Cam;
  flyTo: (point: Vec, zoom?: number) => void;
  fit: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  zoomBy: (factor: number) => void;
};

/** Room reserved around the geometry for labels, in SCREEN pixels per side.
 *  Labels are counter-scaled, so they are a constant size on screen whatever the
 *  zoom. Reserving world units for them instead would change the answer every
 *  time the scale changed, and the fit would never settle. */
const LABEL_MARGIN_X = 180;
const LABEL_MARGIN_Y = 90;

export function usePathCamera(reduced: boolean): PathCamera {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDragging, setDragging] = useState(false);

  const cam = useRef<Cam>({ x: 0, y: 0, scale: 0.9 });
  const target = useRef<Cam | null>(null);
  const velocity = useRef<Cam>({ x: 0, y: 0, scale: 0 });
  const frame = useRef<number | null>(null);
  const lastTime = useRef(0);

  /** Writes the camera to the DOM. The only place that touches these styles. */
  const paint = useCallback(() => {
    const world = worldRef.current;
    const stage = stageRef.current;
    if (!world || !stage) return;
    const { x, y, scale } = cam.current;
    world.style.transform = `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})`;
    stage.style.setProperty("--path-zoom", String(scale));
  }, []);

  const step = useCallback(
    (now: number) => {
      const goal = target.current;
      if (!goal) {
        frame.current = null;
        return;
      }

      // Clamped so a backgrounded tab resuming cannot integrate one huge step.
      const dt = Math.min((now - lastTime.current) / 1000, 1 / 30);
      lastTime.current = now;

      let moving = false;
      for (const key of ["x", "y", "scale"] as const) {
        const displacement = cam.current[key] - goal[key];
        const v = velocity.current[key];
        const nextV = v + (-STIFFNESS * displacement - DAMPING * v) * dt;
        const next = cam.current[key] + nextV * dt;

        // Scale rests tighter: it lives around 1, not in the hundreds.
        const rest = key === "scale" ? REST / 100 : REST;
        if (Math.abs(next - goal[key]) < rest && Math.abs(nextV) < rest * 60) {
          cam.current[key] = goal[key];
          velocity.current[key] = 0;
        } else {
          cam.current[key] = next;
          velocity.current[key] = nextV;
          moving = true;
        }
      }

      paint();

      if (moving) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = null;
        target.current = null;
      }
    },
    [paint]
  );

  const startSpring = useCallback(
    (next: Cam) => {
      if (reduced) {
        cam.current = { ...next };
        velocity.current = { x: 0, y: 0, scale: 0 };
        target.current = null;
        paint();
        return;
      }
      target.current = next;
      if (frame.current === null) {
        lastTime.current = performance.now();
        frame.current = requestAnimationFrame(step);
      }
    },
    [paint, reduced, step]
  );

  const flyTo = useCallback(
    (point: Vec, zoom?: number) => {
      startSpring({
        x: point.x,
        y: point.y,
        scale: zoom === undefined ? cam.current.scale : clampScale(zoom),
      });
    },
    [startSpring]
  );

  const fit = useCallback(
    (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      if (!size.width || !size.height) return;
      const w = Math.max(bounds.maxX - bounds.minX, 1);
      const h = Math.max(bounds.maxY - bounds.minY, 1);
      const usableW = Math.max(size.width - LABEL_MARGIN_X * 2, 120);
      const usableH = Math.max(size.height - LABEL_MARGIN_Y * 2, 120);
      startSpring({
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
        scale: clampScale(Math.min(usableW / w, usableH / h)),
      });
    },
    [size.height, size.width, startSpring]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      startSpring({ ...cam.current, scale: clampScale(cam.current.scale * factor) });
    },
    [startSpring]
  );

  const read = useCallback(() => cam.current, []);

  // Paint once as soon as the layer exists, so nothing ever renders untransformed.
  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Drag to pan, wheel to zoom. Both write the camera directly and repaint.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    let pointerId: number | null = null;
    let last = { x: 0, y: 0 };

    const stopSpring = () => {
      target.current = null;
      velocity.current = { x: 0, y: 0, scale: 0 };
    };

    const down = (e: PointerEvent) => {
      // Buttons and cards handle their own clicks.
      if ((e.target as HTMLElement).closest("[data-path-interactive]")) return;
      pointerId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      stopSpring();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic or already-released pointer id: panning still works
        // without capture, so this must not abort the drag.
      }
      setDragging(true);
    };

    const move = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const s = cam.current.scale || 1;
      cam.current.x -= (e.clientX - last.x) / s;
      cam.current.y -= (e.clientY - last.y) / s;
      last = { x: e.clientX, y: e.clientY };
      paint();
    };

    const up = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      setDragging(false);
    };

    // Non-passive: zooming has to stop the page scrolling underneath.
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      stopSpring();
      const rect = el.getBoundingClientRect();
      const s = cam.current.scale;
      const next = clampScale(s * Math.exp(-e.deltaY * 0.0016));
      if (next === s) return;

      // Keep the world point under the cursor pinned while the scale changes.
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      cam.current.x += cx / s - cx / next;
      cam.current.y += cy / s - cy / next;
      cam.current.scale = next;
      paint();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [paint]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  return useMemo(
    () => ({ stageRef, worldRef, size, isDragging, read, flyTo, fit, zoomBy }),
    [size, isDragging, read, flyTo, fit, zoomBy]
  );
}
