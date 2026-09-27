"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import TangentLogo from "@/components/TangentLogo";
import { formatDeadline } from "@/lib/path-format";
import type { Path } from "@/lib/types";

// Every path you are running, as a field of discs in orbit around you.
//
// Up to six sit on one drawn orbit around a hub, which is balanced at any count
// and echoes the drawing inside a path. Past that, a phyllotaxis spiral (golden
// angle, radius growing as sqrt of the index): it never collides however many
// paths there are, and it is deterministic, so a path does not move just
// because another one was added.
//
// The field is scaled to fit the window rather than scrolled, so the last
// path's label is never cut off by the bottom edge. On a phone a ring of discs
// shrinks past legibility, so there the same paths become a list.
//
// The discs are flat, with a thin ring and a progress arc, not glossy orbs. A
// lit 3D ball on a dark background is the single most generic thing this page
// could have been.

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
/** Half the footprint of one disc with its label, from its centre point. */
const HALF_W = 96;
const HALF_H = 118;
/** Below this width the field becomes a list. */
const LIST_BELOW = 640;

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

function summary(p: PathWithCounts): string {
  const parts = [`${p.counts.work} on the circle`];
  if (p.counts.ideas > 0) parts.push(`${p.counts.ideas} branch${p.counts.ideas === 1 ? "" : "es"}`);
  return parts.join(" · ");
}

function Disc({ progress, size }: { progress: number; size: number }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true" className="tangents-disc">
      <circle className="tangents-sphere-ring" r={44} />
      {progress > 0 && (
        <circle className="tangents-sphere-arc" r={44} pathLength={1} strokeDasharray={`${progress} 1`} />
      )}
      <circle className="tangents-sphere-core" r={11} />
    </svg>
  );
}

export default function PathGallery({ paths, onNew }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placed = useMemo(
    () => paths.map((path, i) => ({ path, at: place(i, paths.length) })),
    [paths]
  );
  const onRing = paths.length > 1 && paths.length <= RING_LIMIT;

  // The real bounding box of what is placed, including each label's footprint,
  // so nothing is sized to a square the spiral never fills.
  const box = useMemo(() => {
    if (placed.length === 0) return { w: 0, h: 0, ox: 0, oy: 0 };
    const minX = Math.min(...placed.map(({ at }) => at.x)) - HALF_W;
    const maxX = Math.max(...placed.map(({ at }) => at.x)) + HALF_W;
    const minY = Math.min(...placed.map(({ at }) => at.y)) - HALF_H;
    const maxY = Math.max(...placed.map(({ at }) => at.y)) + HALF_H;
    return { w: maxX - minX, h: maxY - minY, ox: -minX, oy: -minY };
  }, [placed]);

  const scale =
    stage.width && box.w ? Math.min(1, (stage.width - 24) / box.w, (stage.height - 24) / box.h) : 1;
  const asList = stage.width > 0 && stage.width < LIST_BELOW;

  if (paths.length === 0) {
    return (
      <div className="tangents-empty">
        <span className="tangents-empty-mark" aria-hidden="true">
          <TangentLogo variant="mark" size={56} />
        </span>
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
    <div ref={stageRef} className="tangents-stage">
      {asList ? (
        <ul className="tangents-list" aria-label="Your paths">
          {paths.map((path, i) => {
            const when = formatDeadline(path.deadline);
            return (
              <m.li
                key={path.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", visualDuration: 0.4, bounce: 0.15, delay: Math.min(i * 0.05, 0.3) }}
              >
                <Link href={`/tangents/${path.id}`} className="tangents-row">
                  <Disc progress={progressOf(path)} size={48} />
                  <span className="tangents-row-copy">
                    <strong>{path.title}</strong>
                    <span>{summary(path)}</span>
                    {when && <span className="tangents-sphere-when">{when}</span>}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="tangents-row-chevron" />
                </Link>
              </m.li>
            );
          })}
        </ul>
      ) : (
        stage.width > 0 && (
          <div className="tangents-fit" style={{ width: box.w * scale, height: box.h * scale }}>
            <div
              className="tangents-field"
              style={{ width: box.w, height: box.h, transform: `scale(${scale})` }}
              role="list"
              aria-label="Your paths"
            >
              {onRing && (
                <>
                  <svg
                    className="tangents-orbit-line"
                    width={RING_RADIUS * 2 + 4}
                    height={RING_RADIUS * 2 + 4}
                    style={{ left: box.ox - RING_RADIUS - 2, top: box.oy - RING_RADIUS - 2 }}
                    aria-hidden="true"
                  >
                    <circle cx={RING_RADIUS + 2} cy={RING_RADIUS + 2} r={RING_RADIUS} />
                  </svg>
                  <div className="tangents-hub" style={{ left: box.ox, top: box.oy }} aria-hidden="true">
                    <TangentLogo variant="mark" size={40} />
                    <span>
                      {paths.length} paths
                    </span>
                  </div>
                </>
              )}

              {placed.map(({ path, at }, i) => {
                const when = formatDeadline(path.deadline);
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
                    <Link href={`/tangents/${path.id}`} className="tangents-sphere">
                      <Disc progress={progressOf(path)} size={112} />
                      <span className="tangents-sphere-label">
                        <strong>{path.title}</strong>
                        <span>{summary(path)}</span>
                        {when && <span className="tangents-sphere-when">{when}</span>}
                      </span>
                    </Link>
                  </m.div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
