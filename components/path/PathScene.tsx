"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Plus, Sparkles } from "lucide-react";
import PathAmbient from "./PathAmbient";
import { usePathCamera } from "./usePathCamera";
import { layoutPath, ROOT_RADIUS } from "@/lib/path-layout";
import type { PathLayout } from "@/lib/path-layout";
import type { Path, PathNode } from "@/lib/types";

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
  busyId: string | null;
  onFocus: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onGenerate: (id: string) => void;
  onAddWork: (parentId: string | null) => void;
  registerFit: (fit: () => void) => void;
};

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
  busyId,
  onFocus,
  onToggleExpand,
  onGenerate,
  onAddWork,
  registerFit,
}: Props) {
  const reduced = useReducedMotion() ?? false;
  const camera = usePathCamera(reduced);

  const layout: PathLayout = useMemo(() => layoutPath(nodes, { expanded }), [nodes, expanded]);
  const live = useMemo(() => branchOf(nodes, focusedId), [nodes, focusedId]);
  const dimming = live.size > 0;

  // Let the page trigger "zoom to fit" without reaching into the camera.
  const fitRef = useRef(camera.fit);
  fitRef.current = camera.fit;
  useEffect(() => {
    registerFit(() => fitRef.current(layout.bounds));
  }, [layout.bounds, registerFit]);

  // Frame the whole tree once, then leave the camera alone.
  //
  // "Once" has to mean once there is something to frame: the first paint happens
  // before the nodes have loaded, and fitting an empty tree then locking the
  // camera left the real tree hanging off the edge of the screen.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !camera.size.width || layout.members.length === 0) return;
    framed.current = true;
    camera.fit(layout.bounds);
  }, [camera, layout.bounds, layout.members.length]);

  // Following the focus is the point of the camera: picking a node off-screen
  // should bring you to it rather than leaving you to hunt for it.
  useEffect(() => {
    if (!focusedId) return;
    const point = layout.points.get(focusedId);
    if (!point) return;
    const zoom = Math.max(camera.read().scale, 0.75);
    const panelled = camera.size.width > 860;
    camera.flyTo({ x: point.x + (panelled ? PANEL_W / 2 / zoom : 0), y: point.y }, zoom);
    // Re-running on layout would fight the user's own panning after an expand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId]);

  const nodeState = (node: PathNode) =>
    [
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
      aria-label="Your path, as circles and tangents. Drag to move, scroll to zoom."
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
            <circle
              key={`c-${circle.id}`}
              className={`path-ring${dimming && circle.id !== "goal" && !live.has(circle.id) ? " is-dim" : ""}`}
              cx={circle.center.x}
              cy={circle.center.y}
              r={circle.radius}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Radius from centre to member: what the tangent is perpendicular to. */}
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

          {/* The tangents. Green is reserved for these and nothing else. */}
          {layout.tangents.map((tangent) => {
            const isLive = !dimming || live.has(tangent.node.id);
            const kept = tangent.node.status === "accepted" || tangent.node.status === "done";
            return (
              <g key={`t-${tangent.node.id}`} className={`path-tangent ${nodeState(tangent.node)}`}>
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
              </g>
            );
          })}

          {/* The goal's light, at the centre of everything. */}
          <circle cx={0} cy={0} r={ROOT_RADIUS * 0.85} fill="url(#path-core)" />
        </svg>

        <div className="path-labels">
          {/* The goal. */}
          <div className="path-point path-point-goal" style={{ left: 0, top: 0 }}>
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
          </div>

          {/* Work, on its circle. */}
          <AnimatePresence initial={false}>
            {layout.members.map((member) => (
              <m.div
                key={member.node.id}
                className="path-point"
                style={{ left: member.point.x, top: member.point.y }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", visualDuration: 0.4, bounce: 0.1 }}
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
          <AnimatePresence initial={false}>
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
                    delay: reduced ? 0 : Math.min(i * 0.035, 0.3),
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
                        {clip(node.title, 46)}
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

      <div className="path-stage-controls">
        <button
          type="button"
          data-path-interactive
          className="path-chip"
          onClick={() => onAddWork(null)}
          title="Add something you already do"
        >
          <Plus size={15} aria-hidden="true" />
          Add work
        </button>
        {focusedId && (
          <button
            type="button"
            data-path-interactive
            className="path-chip is-accent"
            onClick={() => onGenerate(focusedId)}
            disabled={busyId === focusedId}
          >
            <Sparkles size={15} aria-hidden="true" />
            {busyId === focusedId ? "Thinking" : "Branch from here"}
          </button>
        )}
        <span className="path-zoom" role="group" aria-label="Zoom">
          <button type="button" data-path-interactive onClick={() => camera.zoomBy(1 / 1.35)} aria-label="Zoom out">
            −
          </button>
          <button type="button" data-path-interactive onClick={() => camera.fit(layout.bounds)}>
            Fit
          </button>
          <button type="button" data-path-interactive onClick={() => camera.zoomBy(1.35)} aria-label="Zoom in">
            +
          </button>
        </span>
      </div>
    </div>
  );
}
