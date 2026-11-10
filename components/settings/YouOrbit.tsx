"use client";

// The "map of you" (Round 4 §5.4): the student's initials in the middle and a
// slowly turning sphere of facts around them, one coloured cluster per area.
// Drag to turn it; the cards beside it turn it to face their area as they
// scroll into view. No 3D library: each fact is a DOM dot whose sphere
// position is projected every frame, written straight to its style so React
// doesn't re-render at 60fps. Reduced motion: no spin, no easing, still
// draggable. The cards are the accessible list; this is a picture of them.

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion, type MotionValue } from "motion/react";
import type { GroupedFacts, MapGroupKey } from "@/lib/you-map";

type Node = {
  id: string;
  group: MapGroupKey;
  color: string;
  /** Unit-sphere position before rotation. */
  x: number;
  y: number;
  z: number;
  label?: string;
  text?: string;
  count?: number;
};

const TAU = Math.PI * 2;

/** Each area owns a band of longitude; its facts spread inside it. */
function layout(grouped: GroupedFacts): { nodes: Node[]; centers: Record<MapGroupKey, number> } {
  const nodes: Node[] = [];
  const centers = {} as Record<MapGroupKey, number>;
  const sector = TAU / grouped.length;
  grouped.forEach(({ group, facts }, gi) => {
    const lon0 = gi * sector;
    centers[group.key] = lon0;
    // The label sits on the equator at the centre of its band.
    nodes.push({ id: `label:${group.key}`, group: group.key, color: group.color, x: Math.sin(lon0), y: 0, z: Math.cos(lon0), label: group.label, count: facts.length });
    facts.forEach((f, i) => {
      // A small spiral around the label: alternate above/below the equator.
      const ring = Math.floor(i / 2) + 1;
      const side = i % 2 === 0 ? 1 : -1;
      const lat = side * Math.min(1.15, 0.32 * ring + 0.12);
      const lon = lon0 + (((i * 0.61) % 1) - 0.5) * sector * 0.7;
      nodes.push({
        id: f.id,
        group: group.key,
        color: group.color,
        x: Math.cos(lat) * Math.sin(lon),
        y: Math.sin(lat),
        z: Math.cos(lat) * Math.cos(lon),
        text: f.fact,
      });
    });
  });
  return { nodes, centers };
}

export default function YouOrbit({
  grouped,
  initials,
  focus,
  onPick,
  variant,
  spin,
}: {
  grouped: GroupedFacts;
  initials: string;
  /** The area the cards are showing: the sphere turns to face it. */
  focus: MapGroupKey | null;
  onPick: (group: MapGroupKey) => void;
  /** "hero": fills its box (the scroll story in YouMapHero), no card frame. */
  variant?: "hero";
  /** Extra turn from outside (radians), e.g. driven by scrolling. */
  spin?: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const { nodes, centers } = useMemo(() => layout(grouped), [grouped]);
  const stage = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const yaw = useRef(0.35);
  const pitch = useRef(-0.42);
  const target = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);

  // Face the focused area: the shortest way round.
  useEffect(() => {
    if (!focus) return;
    const want = -centers[focus];
    const delta = ((((want - yaw.current) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
    target.current = yaw.current + delta;
  }, [focus, centers]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!drag.current) {
        if (target.current !== null) {
          const gap = target.current - yaw.current;
          if (reduce || Math.abs(gap) < 0.002) {
            yaw.current = target.current;
            target.current = null;
          } else {
            yaw.current += gap * Math.min(1, dt / 220);
          }
        } else if (!reduce) {
          yaw.current += dt * 0.00009;
        }
      }
      const box = stage.current;
      if (box) {
        const r = Math.min(box.clientWidth, box.clientHeight) * (variant === "hero" ? 0.4 : 0.34);
        const turn = yaw.current + (spin?.get() ?? 0);
        const cy = Math.cos(turn), sy = Math.sin(turn);
        const cp = Math.cos(pitch.current), sp = Math.sin(pitch.current);
        for (const n of nodes) {
          const el = els.current.get(n.id);
          if (!el) continue;
          // Turn round the vertical axis, then tilt.
          const x1 = n.x * cy + n.z * sy;
          const z1 = -n.x * sy + n.z * cy;
          const y2 = n.y * cp - z1 * sp;
          const z2 = n.y * sp + z1 * cp;
          const depth = (z2 + 1) / 2; // 0 back, 1 front
          const scale = 0.62 + depth * 0.5;
          el.style.transform = `translate(-50%, -50%) translate3d(${(x1 * r).toFixed(1)}px, ${(y2 * r).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
          el.style.opacity = (0.22 + depth * 0.78).toFixed(3);
          el.style.zIndex = String(Math.round(depth * 100));
          el.dataset.back = z2 < -0.15 ? "1" : "";
        }
      }
      if (!reduce || drag.current || target.current !== null) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    raf = requestAnimationFrame(frame);
    // Reduced motion stops the loop once settled; a drag or focus restarts it.
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const box = stage.current;
    box?.addEventListener("tg-orbit-kick", kick);
    // Scrolling turns it too (and wakes the loop under reduced motion).
    const unsubscribe = spin?.on("change", kick);
    return () => {
      cancelAnimationFrame(raf);
      box?.removeEventListener("tg-orbit-kick", kick);
      unsubscribe?.();
    };
  }, [nodes, reduce, spin, variant]);

  useEffect(() => {
    stage.current?.dispatchEvent(new Event("tg-orbit-kick"));
  }, [focus]);

  const total = grouped.reduce((n, g) => n + g.facts.length, 0);

  return (
    <div
      ref={stage}
      className={`you-orbit${variant === "hero" ? " is-hero" : ""}`}
      role="img"
      aria-label={`A map of what Tangent knows: ${grouped.map((g) => `${g.group.label}, ${g.facts.length}`).join("; ")}.`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current };
        target.current = null;
        stage.current?.dispatchEvent(new Event("tg-orbit-kick"));
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        yaw.current = d.yaw + (e.clientX - d.x) * 0.008;
        pitch.current = Math.max(-0.9, Math.min(0.9, d.pitch + (e.clientY - d.y) * 0.006));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="you-orbit-ring" aria-hidden="true" />
      <div className="you-orbit-core" aria-hidden="true">
        <span>{initials}</span>
        <small>{total === 1 ? "1 fact" : `${total} facts`}</small>
      </div>
      {nodes.map((n) =>
        n.label ? (
          <button
            key={n.id}
            ref={(el) => void (el ? els.current.set(n.id, el) : els.current.delete(n.id))}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`you-orbit-label${n.count ? "" : " is-empty"}`}
            style={{ "--c": `var(--series-${n.color})`, "--ci": `var(--series-${n.color}-ink)` } as React.CSSProperties}
            onClick={() => onPick(n.group)}
          >
            {n.label}
            <b>{n.count}</b>
          </button>
        ) : (
          <span
            key={n.id}
            ref={(el) => void (el ? els.current.set(n.id, el) : els.current.delete(n.id))}
            aria-hidden="true"
            className="you-orbit-dot"
            style={{ "--c": `var(--series-${n.color})` } as React.CSSProperties}
            onPointerEnter={(e) => {
              const box = stage.current?.getBoundingClientRect();
              const me = e.currentTarget.getBoundingClientRect();
              if (box) setHover({ text: n.text ?? "", x: me.left + me.width / 2 - box.left, y: me.top - box.top });
            }}
            onPointerLeave={() => setHover(null)}
            onClick={() => onPick(n.group)}
          />
        )
      )}
      {hover && (
        <span
          className={`you-orbit-tip${hover.y < 70 ? " is-below" : ""}`}
          style={{ left: Math.max(90, Math.min((stage.current?.clientWidth ?? 0) - 90, hover.x)), top: hover.y }}
          aria-hidden="true"
        >
          {hover.text}
        </span>
      )}
    </div>
  );
}
