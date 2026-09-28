"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Maximize2, Minus, Plus, Shrink } from "lucide-react";
import PathAmbient from "./PathAmbient";
import { usePathCamera } from "./usePathCamera";
import type { Bounds, PathCamera } from "./usePathCamera";
import { layoutPath, ROOT_RADIUS } from "@/lib/path-layout";
import type { PathLayout } from "@/lib/path-layout";
import type { Path, PathNode, TangentStatus } from "@/lib/types";

// The drawing.
//
// Three layers, stacked, all sharing one camera transform:
//
//   canvas   light and dust, for depth          (PathAmbient)
//   svg      circles and tangents, exact        (this file)
//   html     labels and controls, crisp + a11y  (this file)
//
// Geometry lives in SVG because the lines have to be true tangents and stay
// perfectly aligned with the circles at any zoom. Labels live in HTML because
// SVG text is blurry when scaled, unselectable, and awkward for screen readers.
// Both sit inside the same transformed element, so world coordinates land in the
// same place in each.

/** The SVG surface is a fixed square centred on the world origin; the camera
 *  moves it rather than the viewBox changing, so nothing reflows while panning. */
const SURFACE = 9000;

/** Width the inspector takes on the right, including its margin. The camera
 *  shifts by half of it so the node you picked lands in the middle of what you
 *  can actually see, rather than underneath the panel describing it. */
const PANEL_W = 378;

type Props = {
  path: Path;
  nodes: PathNode[];
  focusedId: string | null;
  expanded: Set<string>;
  onFocus: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onAddWork: (parentId: string | null) => void;
  /** Collapse every open circle that is not on the way to the focused node. */
  onTidy: () => void;
  registerFit: (fit: () => void) => void;
};

/** Which branches stay lit. Work on the circle is always shown; the filter is
 *  about ideas, which is where a tree gets crowded. */
type Filter = "all" | "suggested" | "accepted" | "done";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "suggested", label: "Suggested" },
  { id: "accepted", label: "Kept" },
  { id: "done", label: "Done" },
];

/** The live zoom, as a percentage. Subscribes to the camera directly so a
 *  pan or pinch repaints this one span, not the whole scene. */
function ZoomReadout({ camera }: { camera: PathCamera }) {
  const [scale, setScale] = useState(1);
  const { onZoom } = camera;
  useEffect(() => onZoom((next) => setScale(Math.round(next * 100) / 100)), [onZoom]);
  return (
    <span className="path-zoombar-value" aria-live="off">
      {Math.round(scale * 100)}%
    </span>
  );
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** World bounds of a node plus everything laid out beneath it, including the
 *  full extent of any circle that has been opened under it. */
function subtreeBounds(layout: PathLayout, nodes: PathNode[], id: string): Bounds | null {
  const origin = layout.points.get(id);
  if (!origin) return null;
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = children.get(n.parentId) ?? [];
    list.push(n.id);
    children.set(n.parentId, list);
  }
  const b = { minX: origin.x, minY: origin.y, maxX: origin.x, maxY: origin.y };
  const grow = (x: number, y: number, r = 0) => {
    b.minX = Math.min(b.minX, x - r);
    b.minY = Math.min(b.minY, y - r);
    b.maxX = Math.max(b.maxX, x + r);
    b.maxY = Math.max(b.maxY, y + r);
  };
  const circles = new Map(layout.circles.map((c) => [c.id, c]));
  const queue = [id];
  while (queue.length) {
    const next = queue.shift()!;
    const p = layout.points.get(next);
    if (!p) continue;
    grow(p.x, p.y);
    const circle = circles.get(next);
    if (circle) grow(circle.center.x, circle.center.y, circle.radius);
    for (const child of children.get(next) ?? []) queue.push(child);
  }
  return b;
}

/** Ancestors of `id`, plus `id` itself. Everything else dims. */
function branchOf(nodes: PathNode[], id: string | null): Set<string> {
  const live = new Set<string>();
  if (!id) return live;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor = byId.get(id);
  let guard = 0;
  while (cursor && guard++ < 32) {
    live.add(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  for (const n of nodes) if (n.parentId && live.has(n.parentId)) live.add(n.id);
  return live;
}

export default function PathScene({
  path,
  nodes,
  focusedId,
  expanded,
  onFocus,
  onToggleExpand,
  onAddWork,
  onTidy,
  registerFit,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  // Arriving through the field's portal: the goal card is already on screen,
  // in the middle, so it must not play its own entrance, and the camera holds
  // on it for a beat before framing the tree.
  const [fromPortal] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const hit = sessionStorage.getItem("tangents-portal") === path.id;
      if (hit) sessionStorage.removeItem("tangents-portal");
      return hit;
    } catch {
      return false;
    }
  });

  // Entrances are choreographed only on first paint: the rings ripple out from
  // the goal, then the work, then the ideas. Anything added later just appears
  // with its own short spring, rather than waiting out a staged delay.
  const firstPaint = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => {
      firstPaint.current = false;
    }, 1600);
    return () => clearTimeout(t);
  }, []);
  const stage = (base: number, i: number) => (firstPaint.current ? base + Math.min(i * 0.07, 0.6) : 0);
  const reduced = useReducedMotion() ?? false;
  const camera = usePathCamera(reduced);

  const layout: PathLayout = useMemo(() => layoutPath(nodes, { expanded }), [nodes, expanded]);
  const live = useMemo(() => branchOf(nodes, focusedId), [nodes, focusedId]);
  const dimming = live.size > 0;


  // The chrome that covers the stage, in screen pixels: the header on top, the
  // dock and zoom bar underneath, and the inspector while something is open.
  const insetsFor = useCallback(
    (panelOpen: boolean) => {
      const { width, height } = camera.size;
      const phone = width <= 860;
      return {
        top: phone ? 64 : 84,
        bottom: phone ? (panelOpen ? Math.round(height * 0.58) : 124) : 84,
        right: !phone && panelOpen ? PANEL_W : 0,
      };
    },
    [camera.size]
  );

  const fitAll = useCallback(
    () => camera.fit(layout.bounds, { insets: insetsFor(Boolean(focusedId)), anchorWhenClamped: { x: 0, y: 0 } }),
    [camera, layout.bounds, insetsFor, focusedId]
  );

  // Let the page trigger "zoom to fit" (Tidy uses it) without reaching into the camera.
  const fitAllRef = useRef(fitAll);
  fitAllRef.current = fitAll;
  useEffect(() => {
    registerFit(() => fitAllRef.current());
  }, [registerFit]);

  // Frame the whole tree once, then leave the camera alone.
  //
  // "Once" has to mean once there is something to frame: the first paint happens
  // before the nodes have loaded, and fitting an empty tree then locking the
  // camera left the real tree hanging off the edge of the screen.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !camera.size.width || layout.members.length === 0) return;
    framed.current = true;
    if (fromPortal) {
      const t = setTimeout(fitAll, 320);
      return () => clearTimeout(t);
    }
    fitAll();
  }, [camera.size.width, fitAll, layout.members.length]);

  // Following the focus is the point of the camera: picking a node off-screen
  // should bring you to it rather than leaving you to hunt for it.
  //
  // Picking something frames it together with everything branching from it:
  // pick a member and the camera closes in on that stretch of the circle and
  // its tangents; pick an idea whose circle is open and it frames that circle.
  // Capped so a lone leaf is brought close enough to read, not blown up.
  useEffect(() => {
    if (!focusedId) return;
    const bounds = subtreeBounds(layout, nodes, focusedId);
    if (!bounds) return;
    camera.fit(bounds, { insets: insetsFor(true), maxScale: 1.25, minScale: 0.55 });
    // Re-running on layout would fight the user's own panning after an expand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId]);

  // Opening a circle frames it: the new ideas come to you rather than
  // appearing off the edge of the screen.
  const previousExpanded = useRef(expanded);
  useEffect(() => {
    const opened = Array.from(expanded).find((id) => !previousExpanded.current.has(id));
    previousExpanded.current = expanded;
    if (!opened) return;
    const bounds = subtreeBounds(layout, nodes, opened);
    if (bounds) camera.fit(bounds, { insets: insetsFor(Boolean(focusedId)), maxScale: 1.2, minScale: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Past a certain distance idea cards cannot all be read at once, and drawn
  // at full size they pile up. The stage carries a level of detail that CSS
  // uses to fold them to dots; the zoom listener flips it only on crossings.
  useEffect(() => {
    const stage = camera.stageRef.current;
    if (!stage) return;
    return camera.onZoom((scale) => {
      const lod = scale < 0.5 ? "far" : "near";
      if (stage.dataset.lod !== lod) stage.dataset.lod = lod;
    });
  }, [camera]);

  const matches = (status: TangentStatus) => filter === "all" || status === filter;

  const nodeState = (node: PathNode) =>
    [
      node.kind === "idea" && !matches(node.status) ? "is-filtered" : "",
      dimming && live.has(node.id) ? "is-live" : "",
      node.status === "accepted" || node.status === "done" ? "is-kept" : "is-suggested",
      node.status === "done" ? "is-done" : "",
      focusedId === node.id ? "is-focused" : "",
      dimming && !live.has(node.id) ? "is-dim" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div
      ref={camera.stageRef}
      className={`path-stage${camera.isDragging ? " is-dragging" : ""}`}
      role="application"
      aria-label="Your path, as circles and tangents. Drag to move; scroll or pinch to zoom."
    >
      <PathAmbient read={camera.read} reduced={reduced} />

      <div className="path-world" ref={camera.worldRef}>
        <svg
          className="path-geometry"
          width={SURFACE}
          height={SURFACE}
          viewBox={`${-SURFACE / 2} ${-SURFACE / 2} ${SURFACE} ${SURFACE}`}
          style={{ left: -SURFACE / 2, top: -SURFACE / 2 }}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="path-core">
              {/* A whisper, not a lit ball. A bright radial blob behind the
                  centre was the most generic thing on the page. */}
              <stop offset="0%" stopColor="var(--path-goal)" stopOpacity="0.22" />
              <stop offset="60%" stopColor="var(--path-goal)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--path-goal)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Circles, deepest first so a child never paints over its parent. */}
          {layout.circles.map((circle) => (
            <m.circle
              key={`c-${circle.id}`}
              className={`path-ring${dimming && circle.id !== "goal" && !live.has(circle.id) ? " is-dim" : ""}`}
              cx={circle.center.x}
              cy={circle.center.y}
              // Rings ripple out to their radius, deepest last.
              initial={reduced ? false : { r: 0 }}
              animate={{ r: circle.radius }}
              transition={{ type: "spring", visualDuration: 0.9, bounce: 0.12, delay: stage(0.1, circle.depth) }}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Radius from centre to member: what the tangent is perpendicular to. */}
          {/* Faded in as one group: the spokes' own opacity carries dimming. */}
          <m.g
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
          {layout.members.map((member) => {
            const circle = layout.circles.find((c) => c.id === member.circleId);
            if (!circle) return null;
            return (
              <line
                key={`r-${member.node.id}`}
                className={`path-spoke${dimming && !live.has(member.node.id) ? " is-dim" : ""}`}
                x1={circle.center.x}
                y1={circle.center.y}
                x2={member.point.x}
                y2={member.point.y}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          </m.g>

          {/* The tangents. Green is reserved for these and nothing else. */}
          {layout.tangents.map((tangent, i) => {
            const isLive = !dimming || live.has(tangent.node.id);
            const kept = tangent.node.status === "accepted" || tangent.node.status === "done";
            return (
              <m.g
                key={`t-${tangent.node.id}`}
                className={`path-tangent ${nodeState(tangent.node)}`}
                // Each branch arrives with its idea, not ahead of it.
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: firstPaint.current ? stage(0.7, i) : 0 }}
              >
                <line
                  className="path-tangent-line"
                  x1={tangent.touch.x}
                  y1={tangent.touch.y}
                  x2={tangent.end.x}
                  y2={tangent.end.y}
                  vectorEffect="non-scaling-stroke"
                />
                {/* A pulse running the length of a kept branch, only while it is
                    the one you are looking at. Idle glitter everywhere would be
                    noise, and would never stop costing frames. */}
                {kept && isLive && !reduced && focusedId === tangent.node.id && (
                  <line
                    className="path-tangent-pulse"
                    x1={tangent.touch.x}
                    y1={tangent.touch.y}
                    x2={tangent.end.x}
                    y2={tangent.end.y}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle className="path-touch" cx={tangent.touch.x} cy={tangent.touch.y} r={3.5} />
              </m.g>
            );
          })}

          {/* The goal's light, at the centre of everything. */}
          <circle cx={0} cy={0} r={ROOT_RADIUS * 0.85} fill="url(#path-core)" />
        </svg>

        <div className="path-labels">
          {/* The goal. */}
          <m.div
            className="path-point path-point-goal"
            style={{ left: 0, top: 0 }}
            initial={reduced || fromPortal ? false : { opacity: 0, scale: 0.8, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", visualDuration: 0.7, bounce: 0.2 }}
          >
            <div className="path-point-inner">
              <button
                type="button"
                data-path-interactive
                className={`path-goal-node${focusedId === null ? " is-focused" : ""}`}
                onClick={() => onFocus(null)}
              >
                <span className="path-goal-name">{path.title}</span>
                {path.target && path.target !== path.title && (
                  <span className="path-goal-focus">{clip(path.target, 46)}</span>
                )}
              </button>
            </div>
          </m.div>

          {/* Work, on its circle. */}
          <AnimatePresence>
            {layout.members.map((member, i) => (
              <m.div
                key={member.node.id}
                className="path-point is-member"
                // The label sits outside the circle, on the side its point
                // faces, so it never covers the goal or its neighbours.
                style={
                  {
                    left: member.point.x,
                    top: member.point.y,
                    "--ax": Math.cos(member.angle).toFixed(3),
                    "--ay": Math.sin(member.angle).toFixed(3),
                  } as React.CSSProperties
                }
                initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", visualDuration: 0.5, bounce: 0.25, delay: stage(0.35, i) }}
              >
                <div className="path-point-inner">
                  <button
                    type="button"
                    data-path-interactive
                    className={`path-work ${nodeState(member.node)}`}
                    onClick={() => onFocus(member.node.id)}
                    onFocus={() => onFocus(member.node.id)}
                    aria-label={`${member.node.title}. Work on the circle. Open it.`}
                  >
                    <span className="path-work-dot" aria-hidden="true" />
                    <span className="path-work-label">{clip(member.node.title, 28)}</span>
                  </button>
                </div>
              </m.div>
            ))}
          </AnimatePresence>

          {/* Ideas, at the far end of their tangents. */}
          <AnimatePresence>
            {layout.tangents.map((tangent, i) => {
              const node = tangent.node;
              const children = nodes.filter((n) => n.parentId === node.id && n.status !== "dismissed");
              const isOpen = expanded.has(node.id);
              return (
                <m.div
                  key={node.id}
                  className="path-point"
                  style={{ left: tangent.end.x, top: tangent.end.y }}
                  initial={reduced ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{
                    type: "spring",
                    visualDuration: 0.5,
                    bounce: 0.26,
                    delay: reduced ? 0 : firstPaint.current ? stage(0.7, i) : Math.min(i * 0.035, 0.3),
                  }}
                >
                  <div className="path-point-inner">
                    <div className={`path-idea ${nodeState(node)}`}>
                      <button
                        type="button"
                        data-path-interactive
                        className="path-idea-body"
                        onClick={() => onFocus(node.id)}
                        onFocus={() => onFocus(node.id)}
                        aria-label={`Idea: ${node.title}. Open it.`}
                      >
                        <span className="path-idea-title">{clip(node.title, 40)}</span>
                      </button>
                      {children.length > 0 && (
                        <button
                          type="button"
                          data-path-interactive
                          className="path-idea-grow"
                          onClick={() => onToggleExpand(node.id)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Collapse this circle" : `Open the circle that grew from ${node.title}`}
                        >
                          {isOpen ? "−" : children.length}
                        </button>
                      )}
                    </div>
                  </div>
                </m.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="path-dock" role="toolbar" aria-label="Path actions">
        <button
          type="button"
          data-path-interactive
          className="path-dock-btn"
          onClick={() => onAddWork(null)}
          title="Add something you already do"
        >
          <Plus size={15} aria-hidden="true" />
          Add work
        </button>
        <span className="path-dock-sep" aria-hidden="true" />
        <button
          type="button"
          data-path-interactive
          className="path-dock-btn"
          onClick={() => {
            onTidy();
            setFilter("all");
          }}
          title="Close every circle that is not on the way to what you picked"
        >
          <Shrink size={14} aria-hidden="true" />
          Tidy
        </button>
        <span className="path-dock-sep" aria-hidden="true" />
        <div className="path-filter" role="radiogroup" aria-label="Show branches">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              data-path-interactive
              className={`path-filter-btn${filter === f.id ? " is-on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {filter === f.id && (
                <m.span
                  layoutId="path-filter-pill"
                  className="path-filter-pill"
                  transition={{ type: "spring", visualDuration: 0.35, bounce: 0.2 }}
                  aria-hidden="true"
                />
              )}
              <span className="path-filter-label">{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="path-zoombar" role="toolbar" aria-label="Zoom">
        <button
          type="button"
          data-path-interactive
          className="path-zoombar-btn"
          onClick={() => camera.zoomBy(1 / 1.35)}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <ZoomReadout camera={camera} />
        <button
          type="button"
          data-path-interactive
          className="path-zoombar-btn"
          onClick={() => camera.zoomBy(1.35)}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
        <span className="path-dock-sep" aria-hidden="true" />
        <button
          type="button"
          data-path-interactive
          className="path-zoombar-btn"
          onClick={fitAll}
          aria-label="Fit the whole path"
          title="Fit the whole path"
        >
          <Maximize2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
