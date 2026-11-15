"use client";

// "You, mapped" (Round 5B Phase 2): an ivory constellation of everything
// Tangent knows. The student's initials sit in a pearl circle; each fact is a
// small pastel light on a slowly turning sphere, grouped round a white pill
// per area; projects orbit outside as small satellites. Faint lines join facts
// that belong together (lib/you-map-links.ts has the rules).
//
// Three levels: the whole map → one area (its facts spread into a ring with
// their words) → one fact (a card with the full text, where it came from,
// when it was learned and which plans used it). Click or hold to go in; Esc
// or the back chip goes up.
//
// No 3D library. Points are DOM buttons whose sphere position is projected
// every frame and blended toward their spread position for the level, written
// straight to style so React doesn't re-render at 60fps. One canvas under
// them draws the orbit trails and the lines. Reduced motion: no drift and no
// easing; the loop stops once the picture is still.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion, type MotionValue } from "motion/react";
import { ChevronLeft } from "lucide-react";
import type { ContextEntry } from "@/lib/types";
import { ORIGIN_LABEL, originOf, type GroupedFacts, type MapGroupKey } from "@/lib/you-map";
import type { MapLink, PlanRef } from "@/lib/you-map-links";

export type MapLevel = { kind: "root" } | { kind: "area"; key: MapGroupKey } | { kind: "fact"; key: MapGroupKey; id: string };

type Node = {
  id: string;
  kind: "area" | "fact" | "sat";
  group?: MapGroupKey;
  color?: string;
  /** Sphere position before rotation (satellites sit outside the unit sphere). */
  x: number;
  y: number;
  z: number;
  label: string;
  fact?: ContextEntry;
  count?: number;
};

type Spot = { x: number; y: number; side?: "l" | "r" | "c" };

const TAU = Math.PI * 2;
const HOLD_MS = 450;
const DRAG_PX = 4;
const SAT_RADIUS = 1.32;
const SAT_TILT = 0.5;
/** The tilted trails drawn on the canvas, in sphere units: radius and tilt
 *  round the x axis. The last one is the satellites' orbit. */
const TRAILS: [number, number][] = [
  [1, 0],
  [1, 0.95],
  [1, -0.62],
  [SAT_RADIUS, SAT_TILT],
];
const SAT_MAX = 8;

const SOURCE_LABEL: Record<string, string> = {
  manual: "added in Settings",
  chat: "in a chat",
  voice: "said out loud",
};

function layout(grouped: GroupedFacts, plans: readonly PlanRef[]): Node[] {
  const nodes: Node[] = [];
  const sector = TAU / grouped.length;
  grouped.forEach(({ group, facts }, gi) => {
    const lon0 = gi * sector;
    nodes.push({ id: `area:${group.key}`, kind: "area", group: group.key, color: group.color, x: Math.sin(lon0), y: 0, z: Math.cos(lon0), label: group.label, count: facts.length });
    facts.forEach((f, i) => {
      // A loose spiral round the pill, alternating above and below the equator.
      const ring = Math.floor(i / 2) + 1;
      const side = i % 2 === 0 ? 1 : -1;
      const lat = side * Math.min(1.2, 0.26 * ring + 0.14);
      const lon = lon0 + (((i * 0.618) % 1) - 0.5) * sector * 0.78;
      nodes.push({
        id: f.id,
        kind: "fact",
        group: group.key,
        color: group.color,
        x: Math.cos(lat) * Math.sin(lon),
        y: Math.sin(lat),
        z: Math.cos(lat) * Math.cos(lon),
        label: f.fact,
        fact: f,
      });
    });
  });
  plans.slice(0, SAT_MAX).forEach((p, i, all) => {
    const a = (i / all.length) * TAU + 0.4;
    const z0 = Math.sin(a) * SAT_RADIUS;
    nodes.push({ id: `project:${p.id}`, kind: "sat", x: Math.cos(a) * SAT_RADIUS, y: -z0 * Math.sin(SAT_TILT), z: z0 * Math.cos(SAT_TILT), label: p.title });
  });
  return nodes;
}

/** Turn round the vertical axis, then tilt toward the viewer. */
function project(x: number, y: number, z: number, cy: number, sy: number, cp: number, sp: number) {
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return { x: x1, y: y * cp - z1 * sp, z: y * sp + z1 * cp };
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default function YouMap({
  grouped,
  initials,
  plans,
  links,
  usedBy,
  level,
  onLevel,
  focus,
  spin,
  glowIds,
}: {
  grouped: GroupedFacts;
  initials: string;
  /** Projects shown as satellites. */
  plans: readonly PlanRef[];
  links: readonly MapLink[];
  /** Plans that used each fact (lib/you-map-links usageByFact). */
  usedBy: Record<string, PlanRef[]>;
  level: MapLevel;
  onLevel: (level: MapLevel) => void;
  /** The area the cards below are showing: at the top level the sphere turns to face it. */
  focus: MapGroupKey | null;
  /** Extra turn from outside (radians), driven by scrolling. */
  spin?: MotionValue<number>;
  /** Facts just learned: they glow for a moment. */
  glowIds?: ReadonlySet<string>;
}) {
  const reduce = useReducedMotion() ?? false;
  const nodes = useMemo(() => layout(grouped, plans), [grouped, plans]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  // Each point's moving wrapper. The frame loop writes to these plain divs,
  // not the buttons: restyling ~150 <button>s every frame cost ~3x more.
  const movers = useRef(new Map<string, HTMLDivElement>());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const yaw = useRef(0.35);
  const pitch = useRef(-0.38);
  const target = useRef<number | null>(null);
  const press = useRef<{ x: number; y: number; yaw: number; pitch: number; id: number; node: string | null; moved: boolean; held: boolean; timer: number } | null>(null);
  const suppressClick = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const kickRef = useRef<() => void>(() => {});

  // Per-node animation state and the latest screen positions (for the lines).
  const anim = useRef(new Map<string, { mix: number; op: number; last?: Spot; w?: { tf: string; op: string; zi: string; back: string } }>());
  const pos = useRef(new Map<string, { x: number; y: number; op: number }>());

  const areaKey = level.kind === "root" ? null : level.key;
  const factId = level.kind === "fact" ? level.id : null;
  const wide = size.w >= 640;

  // Where each point sits when its area is open: a ring round the centre
  // (two rings when it's crowded), the area's pill just under the initials.
  const spread = useMemo(() => {
    const out = new Map<string, Spot>();
    if (!areaKey || !size.w) return out;
    const facts = nodes.filter((n) => n.kind === "fact" && n.group === areaKey);
    const base = Math.min(size.w * (wide ? 0.34 : 0.4), size.h * 0.38);
    const two = facts.length > 12;
    // Side labels are up to 160px wide (CSS), so on a wide stage the ring is
    // squeezed sideways until they fit; on a phone every label sits above.
    const squeeze = wide ? Math.min(1, Math.max(0.4, (size.w / 2 - 160 - 28) / base)) : 0.8;
    facts.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, facts.length)) * TAU;
      const r = two ? base * (i % 2 === 0 ? 0.98 : 0.66) : base * 0.86;
      const x = Math.cos(a) * r * squeeze;
      const y = Math.sin(a) * r;
      out.set(n.id, { x, y, side: !wide || Math.abs(x) < 8 ? "c" : x > 0 ? "r" : "l" });
    });
    out.set(`area:${areaKey}`, { x: 0, y: wide ? 74 : 62 });
    return out;
  }, [areaKey, nodes, size, wide]);
  const spreadRef = useRef(spread);
  spreadRef.current = spread;

  // Which points are in play at this level (the rest fade back).
  const live = useMemo(() => {
    if (!areaKey) return null;
    return new Set(nodes.filter((n) => n.group === areaKey).map((n) => n.id));
  }, [areaKey, nodes]);
  const liveRef = useRef(live);
  liveRef.current = live;
  const factRef = useRef(factId);
  factRef.current = factId;
  const linksRef = useRef(links);
  linksRef.current = links;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  // Keyboard order: the areas and projects; inside an area, its facts.
  const order = useMemo(() => {
    if (areaKey) return nodes.filter((n) => n.kind === "fact" && n.group === areaKey).map((n) => n.id);
    return nodes.filter((n) => n.kind !== "fact").map((n) => n.id);
  }, [areaKey, nodes]);
  const active = cursor && order.includes(cursor) ? cursor : order[0] ?? null;

  // Face the focused area at the top level: the shortest way round.
  useEffect(() => {
    if (!focus || level.kind !== "root") return;
    const n = byId.get(`area:${focus}`);
    if (!n) return;
    const want = -Math.atan2(n.x, n.z);
    const delta = ((((want - yaw.current) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
    target.current = yaw.current + delta;
    kickRef.current();
  }, [focus, byId, level.kind]);

  useEffect(() => {
    const box = stage.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSize({ w: box.clientWidth, h: box.clientHeight }));
    ro.observe(box);
    setSize({ w: box.clientWidth, h: box.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const box = stage.current;
    const cv = canvas.current;
    if (!box || !cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let colors = { ring: "", line: "" };
    const readColors = () => {
      const cs = getComputedStyle(box);
      colors = { ring: cs.getPropertyValue("--map-ring").trim() || "#e4dccb", line: cs.getPropertyValue("--map-line").trim() || "#cfc3ad" };
    };
    readColors();
    const themeWatch = new MutationObserver(() => {
      readColors();
      kick();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const dragging = !!press.current?.moved;
      const lv = liveRef.current;
      if (!dragging) {
        if (target.current !== null) {
          const gap = target.current - yaw.current;
          if (reduce || Math.abs(gap) < 0.002) {
            yaw.current = target.current;
            target.current = null;
          } else {
            yaw.current += gap * Math.min(1, dt / 220);
          }
        } else if (!reduce && !lv && !hoverRef.current) {
          yaw.current += dt * 0.00008;
        }
      }
      const w = box.clientWidth;
      const h = box.clientHeight;
      const R = Math.min(w, h) * (w < 520 ? 0.34 : 0.36);
      const turn = yaw.current + (spin?.get() ?? 0);
      const cy = Math.cos(turn), sy = Math.sin(turn);
      const cp = Math.cos(pitch.current), sp = Math.sin(pitch.current);
      const k = reduce ? 1 : 1 - Math.exp(-dt / 70);
      const sp2 = spreadRef.current;
      const fid = factRef.current;
      let moving = false;

      for (const n of nodes) {
        const el = movers.current.get(n.id);
        if (!el) continue;
        const p = project(n.x, n.y, n.z, cy, sy, cp, sp);
        const rad = n.kind === "sat" ? SAT_RADIUS : 1;
        const depth = (p.z / rad + 1) / 2; // 0 back, 1 front
        let a = anim.current.get(n.id);
        if (!a) anim.current.set(n.id, (a = { mix: 0, op: 0.25 + depth * 0.75 }));
        const spot = sp2.get(n.id);
        if (spot) a.last = spot;
        const wantMix = spot ? 1 : 0;
        a.mix += (wantMix - a.mix) * k;
        if (Math.abs(wantMix - a.mix) < 0.001) a.mix = wantMix;
        else moving = true;
        const inPlay = !lv || lv.has(n.id);
        let wantOp = !inPlay ? 0.1 : spot ? 1 : 0.25 + depth * 0.75;
        if (fid && spot && n.id !== fid && n.kind === "fact") wantOp = 0.5;
        a.op += (wantOp - a.op) * k;
        if (Math.abs(wantOp - a.op) < 0.002) a.op = wantOp;
        else moving = true;
        const s = a.last;
        const e = a.mix * a.mix * (3 - 2 * a.mix);
        const x = s ? p.x * R + (s.x - p.x * R) * e : p.x * R;
        const y = s ? p.y * R + (s.y - p.y * R) * e : p.y * R;
        let scale = (0.62 + depth * 0.5) * (1 - e) + e;
        if (fid === n.id) scale *= 1.5;
        // Write only what changed: z-index and data-back restyle the element,
        // so they're bucketed and skipped when equal (keeps ~150 points at 60fps).
        const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(2)})`;
        const op = a.op.toFixed(2);
        const zi = String(spot ? 300 : n.kind === "area" ? 150 + Math.round(depth * 20) * 5 : Math.round(depth * 20) * 5);
        const back = !spot && p.z < -0.15 * rad ? "1" : "";
        const w0 = a.w ?? (a.w = { tf: "", op: "", zi: "", back: "-" });
        if (w0.tf !== tf) el.style.transform = w0.tf = tf;
        if (w0.op !== op) el.style.opacity = w0.op = op;
        if (w0.zi !== zi) el.style.zIndex = w0.zi = zi;
        if (w0.back !== back) el.dataset.back = w0.back = back;
        pos.current.set(n.id, { x, y, op: a.op });
      }

      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, h / 2 * dpr);
        ctx.clearRect(-w / 2, -h / 2, w, h);
        // Orbit trails: the far half fainter than the near half.
        const trailAlpha = lv ? 0.35 : 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.ring;
        for (const [r, tilt] of TRAILS) {
          for (const front of [false, true]) {
            ctx.globalAlpha = (front ? 0.95 : 0.4) * trailAlpha;
            ctx.beginPath();
            let pen = false;
            for (let i = 0; i <= 96; i++) {
              const t = (i / 96) * TAU;
              const z0 = Math.sin(t) * r;
              const q = project(Math.cos(t) * r, -z0 * Math.sin(tilt), z0 * Math.cos(tilt), cy, sy, cp, sp);
              if (q.z >= 0 === front) {
                if (pen) ctx.lineTo(q.x * R, q.y * R);
                else ctx.moveTo(q.x * R, q.y * R);
                pen = true;
              } else pen = false;
            }
            ctx.stroke();
          }
        }
        // The lines between facts, and from facts to the projects that used them.
        const hot = hoverRef.current ?? pinnedRef.current ?? fid;
        ctx.strokeStyle = colors.line;
        for (const l of linksRef.current) {
          const pa = pos.current.get(l.a);
          const pb = pos.current.get(l.b);
          if (!pa || !pb) continue;
          const touches = hot !== null && (l.a === hot || l.b === hot);
          let alpha = Math.min(pa.op, pb.op) * (touches ? 0.95 : hot ? 0.18 : 0.45);
          if (lv && !(lv.has(l.a) || lv.has(l.b))) alpha = 0;
          if (alpha < 0.02) continue;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = touches ? 1.4 : 1;
          ctx.setLineDash(l.kind === "used" || l.kind === "goal-project" ? [3, 4] : []);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      const still = reduce && !moving && !press.current?.moved && target.current === null;
      raf = visible && !still ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!raf && visible) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    kickRef.current = kick;
    raf = requestAnimationFrame(frame);
    // Nothing to draw while the map is off screen.
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible) kick();
          });
    io?.observe(box);
    const unsubscribe = spin?.on("change", kick);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      themeWatch.disconnect();
      unsubscribe?.();
      kickRef.current = () => {};
    };
  }, [nodes, reduce, spin]);

  // Any change of level, hover or size redraws (needed when the loop has stopped).
  useEffect(() => kickRef.current(), [level, hover, pinned, size, links]);

  // Keep keyboard focus on the map when the level changes under it.
  const prevLevel = useRef(level);
  useEffect(() => {
    const before = prevLevel.current;
    prevLevel.current = level;
    if (!stage.current?.contains(document.activeElement)) return;
    let next: string | null = null;
    if (level.kind === "root" && before.kind !== "root") next = `area:${before.key}`;
    else if (level.kind === "area" && before.kind === "fact") next = before.id;
    else if (level.kind !== "root") next = level.kind === "fact" ? level.id : order[0] ?? null;
    if (!next) return;
    setCursor(next);
    requestAnimationFrame(() => els.current.get(next!)?.focus({ preventScroll: true }));
  }, [level, order]);

  const open = useCallback(
    (n: Node) => {
      if (n.kind === "area" && n.group) onLevel(level.kind === "area" && level.key === n.group ? { kind: "root" } : { kind: "area", key: n.group });
      else if (n.kind === "fact" && n.group) onLevel(factId === n.id ? { kind: "area", key: n.group } : { kind: "fact", key: n.group, id: n.id });
      else if (n.kind === "sat") setPinned((p) => (p === n.id ? null : n.id));
    },
    [onLevel, level, factId]
  );

  const up = useCallback(() => {
    if (level.kind === "fact") onLevel({ kind: "area", key: level.key });
    else if (level.kind === "area") onLevel({ kind: "root" });
    else setPinned(null);
  }, [level, onLevel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (level.kind === "root" && !pinned) return;
      e.preventDefault();
      e.stopPropagation();
      up();
      return;
    }
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const jump = e.key === "Home" ? "first" : e.key === "End" ? "last" : null;
    if (!step && !jump) return;
    const at = (e.target as HTMLElement).closest<HTMLElement>("[data-node]")?.dataset.node;
    if (!at || !order.length) return;
    e.preventDefault();
    const i = order.indexOf(at);
    const next = jump === "first" ? order[0] : jump === "last" ? order[order.length - 1] : order[(Math.max(0, i) + step + order.length) % order.length];
    setCursor(next);
    els.current.get(next)?.focus({ preventScroll: true });
  };

  const endPress = () => {
    const p = press.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    if (p.moved || p.held) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    press.current = null;
  };

  const total = grouped.reduce((n, g) => n + g.facts.length, 0);
  const openFact = factId ? byId.get(factId)?.fact : undefined;
  const openGroup = areaKey ? grouped.find((g) => g.group.key === areaKey)?.group : undefined;
  const hoverNode = hover ? byId.get(hover) : undefined;
  const hoverPos = hover ? pos.current.get(hover) : undefined;
  const used = openFact ? usedBy[openFact.id] ?? [] : [];
  const satCount = (id: string) => links.filter((l) => l.b === id || l.a === id).length;

  const learned = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "Not recorded" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div
      ref={stage}
      className={`you-map-stage is-${level.kind}${wide ? " is-wide" : ""}`}
      role="group"
      aria-label="Map of what Tangent knows. Arrow keys move between points, Enter opens one, Escape goes back."
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const nodeId = (e.target as HTMLElement).closest<HTMLElement>("[data-node]")?.dataset.node ?? null;
        if ((e.target as HTMLElement).closest(".you-map-card, .you-map-back")) return;
        const p = { x: e.clientX, y: e.clientY, yaw: yaw.current, pitch: pitch.current, id: e.pointerId, node: nodeId, moved: false, held: false, timer: 0 };
        if (nodeId) {
          p.timer = window.setTimeout(() => {
            const cur = press.current;
            const n = byId.get(nodeId);
            if (!cur || cur.moved || !n) return;
            cur.held = true;
            open(n);
          }, HOLD_MS);
        }
        press.current = p;
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (!p.moved) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return;
          p.moved = true;
          window.clearTimeout(p.timer);
          target.current = null;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          kickRef.current();
        }
        yaw.current = p.yaw + (e.clientX - p.x) * 0.008;
        pitch.current = Math.max(-0.9, Math.min(0.9, p.pitch + (e.clientY - p.y) * 0.006));
      }}
      onPointerUp={endPress}
      onPointerCancel={endPress}
    >
      <svg className="you-map-grain" aria-hidden="true" focusable="false">
        <filter id="you-map-grain-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#you-map-grain-f)" />
      </svg>

      <div className="you-map-world">
        <canvas ref={canvas} className="you-map-canvas" aria-hidden="true" />
        <div className="you-map-core" aria-hidden="true">
          <span>{initials}</span>
          <small>{total === 1 ? "1 fact" : `${total} facts`}</small>
        </div>

        {nodes.map((n) => {
          const inOrder = order.includes(n.id);
          const common = {
            ref: (el: HTMLButtonElement | null) => void (el ? els.current.set(n.id, el) : els.current.delete(n.id)),
            type: "button" as const,
            "data-node": n.id,
            tabIndex: inOrder && n.id === active ? 0 : -1,
            "aria-hidden": inOrder ? undefined : true,
            // Colour by attribute, not an inline custom property: an inline --c on
            // ~150 moving elements made every frame's restyle ~6ms slower.
            "data-c": n.color,
            onClick: () => {
              if (suppressClick.current) return;
              open(n);
            },
            onPointerEnter: () => {
              hoverRef.current = n.id;
              setHover(n.id);
            },
            onPointerLeave: () => {
              hoverRef.current = null;
              setHover(null);
            },
            onFocus: () => {
              setCursor(n.id);
              hoverRef.current = n.id;
              setHover(n.id);
            },
            onBlur: () => {
              hoverRef.current = null;
              setHover(null);
            },
          };
          const mover = (child: React.ReactNode) => (
            <div
              key={n.id}
              ref={(el) => void (el ? movers.current.set(n.id, el) : movers.current.delete(n.id))}
              className="you-map-node"
              data-dim={live && !live.has(n.id) ? "1" : undefined}
            >
              {child}
            </div>
          );
          if (n.kind === "area") {
            return mover(
              <button {...common} className={`you-map-pill${n.count ? "" : " is-empty"}${areaKey === n.group ? " is-open" : ""}`} aria-label={`${n.label}, ${n.count === 1 ? "1 fact" : `${n.count} facts`}`} aria-expanded={areaKey === n.group}>
                <span className="you-map-pill-dot" aria-hidden="true" />
                {n.label}
                <b>{n.count}</b>
              </button>
            );
          }
          if (n.kind === "sat") {
            const k = satCount(n.id);
            return mover(
              <button {...common} className={`you-map-sat${pinned === n.id ? " is-pinned" : ""}`} aria-label={`Project: ${n.label}, linked to ${k === 1 ? "1 fact" : `${k} facts`}`} aria-pressed={pinned === n.id}>
                <span className="you-map-sat-dot" aria-hidden="true" />
                <span className="you-map-sat-name">{short(n.label, 22)}</span>
              </button>
            );
          }
          const s = spread.get(n.id);
          return mover(
            <button
              {...common}
              className={`you-map-light${glowIds?.has(n.id) ? " is-new" : ""}${factId === n.id ? " is-open" : ""}${n.fact && originOf(n.fact) === "guess" ? " is-guess" : ""}`}
              aria-label={n.label}
              aria-expanded={factId === n.id}
              data-side={s?.side}
            >
              <span className="you-map-bloom" aria-hidden="true" />
              <span className="you-map-dot" aria-hidden="true" />
              {s && spread.size <= 14 && <span className="you-map-flabel" aria-hidden="true">{short(n.label, 40)}</span>}
            </button>
          );
        })}
      </div>

      {hoverNode && hoverPos && hoverNode.kind === "fact" && hover !== factId && !(spread.has(hover!) && spread.size <= 14) && (
        <span
          className={`you-map-tip${hoverPos.y + size.h / 2 < 80 ? " is-below" : ""}`}
          style={{ left: Math.max(100, Math.min(size.w - 100, hoverPos.x + size.w / 2)), top: hoverPos.y + size.h / 2 }}
          aria-hidden="true"
        >
          {hoverNode.label}
        </span>
      )}

      {level.kind !== "root" && (
        <button type="button" className="you-map-back" onClick={up}>
          <ChevronLeft size={16} aria-hidden="true" />
          {level.kind === "fact" ? openGroup?.label ?? "Back" : "All areas"}
        </button>
      )}

      {openFact && openGroup && (
        <div className="you-map-card" role="region" aria-label="About this fact" aria-live="polite" style={{ "--c": `var(--map-${openGroup.color})` } as React.CSSProperties}>
          <p className="you-map-card-kicker">
            <span className="you-map-pill-dot" aria-hidden="true" />
            {openGroup.label}
          </p>
          <p className="you-map-card-text">{openFact.fact}</p>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>
                {ORIGIN_LABEL[originOf(openFact)]}
                {SOURCE_LABEL[openFact.source] ? `, ${SOURCE_LABEL[openFact.source]}` : ""}
              </dd>
            </div>
            <div>
              <dt>Learned</dt>
              <dd>{learned(openFact.timestamp)}</dd>
            </div>
            <div>
              <dt>Used in</dt>
              <dd>
                {used.length > 0
                  ? used.map((p) => p.title).join(", ")
                  : openFact.usedCount
                    ? `${openFact.usedCount} ${openFact.usedCount === 1 ? "plan" : "plans"}`
                    : "No plan yet"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
