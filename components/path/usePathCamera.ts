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
  /** Called with the scale whenever the camera paints. Returns an unsubscribe. */
  onZoom: (listener: (scale: number) => void) => () => void;
};

/** Room reserved around the geometry for labels, in SCREEN pixels per side.
 *  Labels are counter-scaled, so they are a constant size on screen whatever the
 *  zoom. Reserving world units for them instead would change the answer every
 *  time the scale changed, and the fit would never settle. */
const LABEL_MARGIN_X = 180;
const LABEL_MARGIN_Y = 90;

/** On a phone a fixed 180px a side leaves almost nothing to fit into, so the
 *  margin is capped at a share of the stage instead. */
function labelMargins(width: number, height: number): { x: number; y: number } {
  return {
    x: Math.min(LABEL_MARGIN_X, width * 0.2),
    y: Math.min(LABEL_MARGIN_Y, height * 0.1),
  };
}

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
  const zoomListeners = useRef(new Set<(scale: number) => void>());

  /** Writes the camera to the DOM. The only place that touches these styles. */
  const paint = useCallback(() => {
    const world = worldRef.current;
    const stage = stageRef.current;
    if (!world || !stage) return;
    const { x, y, scale } = cam.current;
    world.style.transform = `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})`;
    stage.style.setProperty("--path-zoom", String(scale));
    zoomListeners.current.forEach((listener) => listener(scale));
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
      const margin = labelMargins(size.width, size.height);
      const usableW = Math.max(size.width - margin.x * 2, 120);
      const usableH = Math.max(size.height - margin.y * 2, 120);
      const wanted = Math.min(usableW / w, usableH / h);
      // Labels hold their size while the drawing scales, so past a point
      // "fit everything" turns a big tree into a pile of overlapping cards.
      // Below that floor, frame the goal at a readable zoom instead and let
      // the person pinch or drag out to the rest.
      const floor = size.width < 640 ? 0.6 : 0.32;
      if (wanted < floor) {
        startSpring({ x: 0, y: 0, scale: clampScale(floor) });
        return;
      }
      startSpring({
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
        scale: clampScale(wanted),
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

  const onZoom = useCallback((listener: (scale: number) => void) => {
    zoomListeners.current.add(listener);
    listener(cam.current.scale);
    return () => {
      zoomListeners.current.delete(listener);
    };
  }, []);

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

    // Every finger or mouse button currently down on the stage. One pointer
    // pans; two pinch, zooming about the point between them.
    const pointers = new Map<number, Vec>();
    let pinch: { distance: number; mid: Vec } | null = null;

    const stopSpring = () => {
      target.current = null;
      velocity.current = { x: 0, y: 0, scale: 0 };
    };

    const pinchState = () => {
      const [a, b] = Array.from(pointers.values());
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };

    const down = (e: PointerEvent) => {
      // Buttons and cards handle their own clicks.
      if ((e.target as HTMLElement).closest("[data-path-interactive]")) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stopSpring();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic or already-released pointer id: panning still works
        // without capture, so this must not abort the drag.
      }
      if (pointers.size === 2) pinch = pinchState();
      setDragging(true);
    };

    const move = (e: PointerEvent) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const current = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, current);

      if (pointers.size >= 2 && pinch) {
        const rect = el.getBoundingClientRect();
        const next = pinchState();
        const s = cam.current.scale;
        const scale = clampScale(s * (next.distance / pinch.distance));
        // Keep the world point under the fingers' midpoint pinned to it.
        const px = pinch.mid.x - rect.left - rect.width / 2;
        const py = pinch.mid.y - rect.top - rect.height / 2;
        const nx = next.mid.x - rect.left - rect.width / 2;
        const ny = next.mid.y - rect.top - rect.height / 2;
        cam.current.x += px / s - nx / scale;
        cam.current.y += py / s - ny / scale;
        cam.current.scale = scale;
        pinch = next;
        paint();
        return;
      }

      const s = cam.current.scale || 1;
      cam.current.x -= (current.x - previous.x) / s;
      cam.current.y -= (current.y - previous.y) / s;
      paint();
    };

    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      pinch = pointers.size === 2 ? pinchState() : null;
      if (pointers.size === 0) setDragging(false);
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
    () => ({ stageRef, worldRef, size, isDragging, read, flyTo, fit, zoomBy, onZoom }),
    [size, isDragging, read, flyTo, fit, zoomBy, onZoom]
  );
}
