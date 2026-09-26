"use client";

import type { Anchor, TangentIdea } from "@/lib/types";

// The logo, made operable. Your anchors sit ON the circle. The selected one is
// always rotated to TOUCH, the single point where the tangent leaves the circle
// and rises to the goal — so the line reads at the same angle as the mark no
// matter which anchor you pick, and switching anchors turns the circle.
//
//   P  = C + r·(cos θ, sin θ)        the touch point
//   t̂  = (−sin θ, cos θ)             unit tangent at P, ⟂ to the radius
//   line: P − BACK·t̂  →  P + REACH·t̂
//
// Branch text lives in the list below, not here. On the diagram a branch is a
// numbered stop on the line; crowding the drawing with sentences was the first
// thing that made it unreadable.

const VB = { w: 1000, h: 520 };
const C = { x: 300, y: 340 };
const R = 125;
/** Where the selected anchor always sits: upper-left, so t̂ points up-right. */
const TOUCH = -116;
const BACK = 45;
const REACH = 400;
const STOP_FRACTIONS = [0.38, 0.56, 0.74];

type Props = {
  anchors: Anchor[];
  tangents: TangentIdea[];
  selectedId: string | null;
  goalLabel: string | null;
  onSelect: (id: string) => void;
};

const rad = (deg: number) => (deg * Math.PI) / 180;

function pointAt(deg: number) {
  return { x: C.x + R * Math.cos(rad(deg)), y: C.y + R * Math.sin(rad(deg)) };
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function TangentDiagram({ anchors, tangents, selectedId, goalLabel, onSelect }: Props) {
  const total = anchors.length;
  const step = 360 / Math.max(total, 1);
  const selectedIndex = anchors.findIndex((a) => a.id === selectedId);
  const hasSelection = selectedIndex >= 0;

  // Turn the whole ring so the selected anchor lands on TOUCH. Base positions
  // start at the top of the circle; spin is the delta from there.
  const spin = hasSelection ? TOUCH - (-90 + selectedIndex * step) : 0;

  const P = pointAt(TOUCH);
  const tx = -Math.sin(rad(TOUCH));
  const ty = Math.cos(rad(TOUCH));

  const start = { x: P.x - BACK * tx, y: P.y - BACK * ty };
  const end = { x: P.x + REACH * tx, y: P.y + REACH * ty };

  const live = tangents.filter((t) => t.anchorId === selectedId && t.status !== "dismissed").slice(0, 3);
  const stops = live.map((t, i) => {
    const f = STOP_FRACTIONS[i];
    return { t, n: i + 1, x: P.x + REACH * f * tx, y: P.y + REACH * f * ty };
  });

  return (
    <svg
      className="tangent-diagram"
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      role="img"
      aria-label={
        hasSelection
          ? `${anchors[selectedIndex].title}, with ${live.length} branch${live.length === 1 ? "" : "es"} toward ${goalLabel ?? "your goal"}`
          : "Your work as a circle. Select an anchor to draw its tangent."
      }
    >
      {/* everything you already have */}
      <circle className="td-circle" cx={C.x} cy={C.y} r={R} />

      {hasSelection && (
        <g className="td-branch">
          <line className="td-line" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />

          {stops.map((s) => (
            <g key={s.t.id} className={`td-stop is-${s.t.status}`} transform={`translate(${s.x} ${s.y})`}>
              <circle r={11} />
              <text className="td-stop-num" y={4} textAnchor="middle">{s.n}</text>
            </g>
          ))}

          {/* where the line is heading */}
          <circle className="td-goal" cx={end.x} cy={end.y} r={12} />
          {goalLabel && (
            <text className="td-goal-label" x={end.x} y={end.y - 26} textAnchor="middle">
              {clip(goalLabel, 22)}
            </text>
          )}
        </g>
      )}

      {/* One ring, rotated about C. Interpolating each dot's translate() would
          tween them straight across the interior; rotating the group is the
          only way the motion follows the circle. */}
      <g className="td-ring" transform={`rotate(${spin} ${C.x} ${C.y})`}>
        {anchors.map((a, i) => {
          const base = -90 + i * step;
          const p = pointAt(base);
          const active = a.id === selectedId;
          // Which side the label sits on depends on where the dot has ended up.
          const right = Math.cos(rad(base + spin)) >= -0.05;
          return (
            <g
              key={a.id}
              className={`td-anchor${active ? " is-active" : ""}`}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onSelect(a.id)}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={a.title}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(a.id);
                }
              }}
            >
              <circle className="td-anchor-hit" r={20} />
              <circle className="td-anchor-dot" r={active ? 9 : 6} />
              {/* undo the ring's rotation so the text stays upright */}
              <g className="td-anchor-text" transform={`rotate(${-spin})`}>
                <text
                  className="td-anchor-label"
                  x={right ? 20 : -20}
                  y={active ? -18 : 4}
                  textAnchor={right ? "start" : "end"}
                >
                  {clip(a.title, 24)}
                </text>
              </g>
            </g>
          );
        })}
      </g>

    </svg>
  );
}
