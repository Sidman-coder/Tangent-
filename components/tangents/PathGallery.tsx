"use client";

import { useMemo } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { Plus } from "lucide-react";
import type { Path } from "@/lib/types";

// Every path you are running, as a field of spheres.
//
// Laid out on a phyllotaxis spiral (golden angle, radius growing as sqrt of the
// index) rather than a grid. It reads as a constellation instead of a table,
// it never collides however many paths there are, and it is deterministic, so a
// path does not move just because another one was added.
//
// The spheres are flat discs with a thin ring and a progress arc, not glossy
// orbs. A lit 3D ball on a dark background is the single most generic thing
// this page could have been.

export type PathWithCounts = Path & {
  counts: { work: number; ideas: number; kept: number; done: number };
};

type Props = {
  paths: PathWithCounts[];
  onNew: () => void;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Distance of the first spiral ring from centre. Later ones grow as sqrt(i). */
const SPREAD = 210;
/** Up to this many, they sit on one ring; past it the spiral takes over. */
const RING_LIMIT = 6;
/** Wide enough that six cards on the ring never touch. */
const RING_RADIUS = 235;

/**
 * Where each sphere sits.
 *
 * A spiral is the right answer for many paths and the wrong one for three: it
 * packs from the centre outward, so a handful of paths end up huddled in one
 * corner of a large empty field. Under seven they go on a single centred ring
 * instead, which is balanced at any count and echoes the drawing inside.
 */
function place(index: number, total: number): { x: number; y: number } {
  if (total === 1) return { x: 0, y: 0 };

  if (total <= RING_LIMIT) {
    // Start at the top and go clockwise, so the first path reads first.
    const theta = -Math.PI / 2 + (index / total) * Math.PI * 2;
    return { x: RING_RADIUS * Math.cos(theta), y: RING_RADIUS * Math.sin(theta) };
  }

  if (index === 0) return { x: 0, y: 0 };
  const r = SPREAD * Math.sqrt(index);
  const theta = index * GOLDEN_ANGLE;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/** How far along a path is: what you have kept, against everything drafted.
 *  Honest rather than flattering - an untouched path reads as untouched. */
function progressOf(p: PathWithCounts): number {
  const total = p.counts.ideas;
  if (total === 0) return 0;
  return Math.min(1, p.counts.kept / total);
}

export default function PathGallery({ paths, onNew }: Props) {
  const placed = useMemo(
    () => paths.map((path, i) => ({ path, at: place(i, paths.length) })),
    [paths]
  );

  // Sized to the real bounding box of what is placed, not to a square big
  // enough for the whole spiral. Three paths occupy a corner of that square, so
  // sizing to the square left the field taller than the window and pushed the
  // spheres off the bottom.
  const box = useMemo(() => {
    if (placed.length === 0) return { w: 0, h: 0, ox: 0, oy: 0 };
    const padX = 100;
    const padY = 96;
    const minX = Math.min(...placed.map(({ at }) => at.x)) - padX;
    const maxX = Math.max(...placed.map(({ at }) => at.x)) + padX;
    const minY = Math.min(...placed.map(({ at }) => at.y)) - padY;
    const maxY = Math.max(...placed.map(({ at }) => at.y)) + padY;
    return { w: maxX - minX, h: maxY - minY, ox: -minX, oy: -minY };
  }, [placed]);

  if (paths.length === 0) {
    return (
      <div className="tangents-empty">
        <h2>Nothing in orbit yet</h2>
        <p>
          A path is one thing you are trying to reach: a university place, a job, a rating, a body of work.
          Tangent branches off what you already have to get you there.
        </p>
        <button type="button" className="path-btn is-primary" onClick={onNew}>
          <Plus size={15} aria-hidden="true" />
          Start your first path
        </button>
      </div>
    );
  }

  return (
    <div
      className="tangents-field"
      style={{ width: box.w, height: box.h }}
      role="list"
      aria-label="Your paths"
    >
      {placed.map(({ path, at }, i) => {
        const progress = progressOf(path);
        return (
          <m.div
            key={path.id}
            className="tangents-orbit"
            style={{ left: box.ox + at.x, top: box.oy + at.y }}
            role="listitem"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              visualDuration: 0.5,
              bounce: 0.2,
              delay: Math.min(i * 0.06, 0.4),
            }}
          >
            <Link href={`/tangents/${path.id}`} className="tangents-sphere" data-path-interactive>
              <svg viewBox="-50 -50 100 100" aria-hidden="true">
                <circle className="tangents-sphere-ring" r={44} />
                {progress > 0 && (
                  <circle
                    className="tangents-sphere-arc"
                    r={44}
                    pathLength={1}
                    strokeDasharray={`${progress} 1`}
                  />
                )}
                <circle className="tangents-sphere-core" r={11} />
              </svg>
              <span className="tangents-sphere-label">
                <strong>{path.title}</strong>
                <span>
                  {path.counts.work} on the circle
                  {path.counts.ideas > 0 && ` · ${path.counts.ideas} branch${path.counts.ideas === 1 ? "" : "es"}`}
                </span>
                {path.deadline && <span className="tangents-sphere-when">{path.deadline}</span>}
              </span>
            </Link>
          </m.div>
        );
      })}
    </div>
  );
}
