"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import TangentLogo from "@/components/TangentLogo";
import PathAmbient from "@/components/path/PathAmbient";
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
// Motion, and what each piece is for:
//   the orbit draws itself, then the paths launch out of the hub   - where they come from
//   progress arcs sweep to their value                              - how far along each is
//   a disc leans toward the pointer                                 - it is the thing to press
//   opening one widens it into the path's own dark                  - you went into it, not away
// Everything collapses to a plain fade under reduced motion.

export type PathWithCounts = Path & {
  counts: { work: number; ideas: number; kept: number; done: number };
};

type Props = {
  paths: PathWithCounts[];
  onNew: () => void;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Distance of the first spiral ring from centre. Later ones grow as sqrt(i). */
const SPREAD = 190;
/** Up to this many, they sit on one ring; past it the spiral takes over. */
const RING_LIMIT = 6;
/** Wide enough that six cards on the ring never touch. */
const RING_RADIUS = 235;
/** Half the footprint of one disc with its label, from its centre point. */
const HALF_W = 96;
const HALF_H = 118;
/** Below this width the field becomes a list. */
const LIST_BELOW = 640;
/** Out-expo: fast off the mark, long settle. The house curve for entrances. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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
  return parts.join(", ");
}

function Disc({ progress, size, delay, reduced }: { progress: number; size: number; delay: number; reduced: boolean }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true" className="tangents-disc">
      <circle className="tangents-sphere-halo" r={48} />
      <circle className="tangents-sphere-ring" r={44} />
      {progress > 0 && (
        <m.circle
          className="tangents-sphere-arc"
          r={44}
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: progress }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: delay + 0.35 }}
        />
      )}
      <circle className="tangents-sphere-core" r={11} />
    </svg>
  );
}

/** One path on the field. The disc leans toward the pointer and the label
 *  follows at a fraction, so it has depth without tilting any text. Driven by
 *  motion values, never React state, so tracking the pointer costs no renders. */
function Sphere({
  path,
  index,
  at,
  reduced,
  onOpen,
}: {
  path: PathWithCounts;
  index: number;
  at: { x: number; y: number };
  reduced: boolean;
  onOpen: (path: PathWithCounts, origin: { x: number; y: number }) => void;
}) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 220, damping: 18, mass: 0.6 });
  const y = useSpring(py, { stiffness: 220, damping: 18, mass: 0.6 });
  const labelX = useTransform(x, (v) => v * 0.35);
  const labelY = useTransform(y, (v) => v * 0.35);
  const when = formatDeadline(path.deadline);
  const delay = 0.45 + Math.min(index * 0.08, 0.5);

  const lean = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const svg = e.currentTarget.querySelector("svg");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    // A pull, not a follow: capped, so the disc never leaves its place.
    px.set(Math.max(-10, Math.min(10, dx * 0.18)));
    py.set(Math.max(-10, Math.min(10, dy * 0.18)));
  };
  const release = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <m.div
      className="tangents-orbit"
      style={{ left: `calc(var(--ox) + ${at.x}px)`, top: `calc(var(--oy) + ${at.y}px)` }}
      role="listitem"
      // Launched out of the hub along its own spoke, so the field reads as
      // radiating from you rather than fading in as a grid.
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: -at.x * 0.55, y: -at.y * 0.55, scale: 0.5 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ type: "spring", visualDuration: 0.8, bounce: 0.22, delay }}
    >
      <Link
        href={`/tangents/${path.id}`}
        className="tangents-sphere"
        onPointerMove={lean}
        onPointerLeave={release}
        onClick={(e) => {
          // Plain navigation for anything that is not a plain click.
          if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          const svg = e.currentTarget.querySelector("svg");
          const rect = svg?.getBoundingClientRect();
          onOpen(path, rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: e.clientX, y: e.clientY });
        }}
      >
        <m.span className="tangents-disc-wrap" style={{ x, y }}>
          <Disc progress={progressOf(path)} size={112} delay={delay} reduced={reduced} />
        </m.span>
        <m.span className="tangents-sphere-label" style={{ x: labelX, y: labelY }}>
          <strong>{path.title}</strong>
          <span>{summary(path)}</span>
          {when && <span className="tangents-sphere-when">{when}</span>}
        </m.span>
      </Link>
    </m.div>
  );
}

export default function PathGallery({ paths, onNew }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [portal, setPortal] = useState<{ id: string; x: number; y: number } | null>(null);

  // The dust behind the field drifts against the pointer, so the field has
  // depth before anything is touched. A ref, read by the canvas each frame.
  const pointer = useRef({ x: 0, y: 0, scale: 1 });
  const readPointer = useCallback(() => pointer.current, []);

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

  const open = useCallback(
    (path: PathWithCounts, origin: { x: number; y: number }) => {
      router.prefetch(`/tangents/${path.id}`);
      setPortal({ id: path.id, ...origin });
    },
    [router]
  );

  if (paths.length === 0) {
    return (
      <div className="tangents-empty">
        <PathAmbient read={readPointer} reduced={reduced} />
        <m.span
          className="tangents-empty-mark"
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0, scale: 0.8, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", visualDuration: 0.7, bounce: 0.3 }}
        >
          <TangentLogo variant="mark" size={56} />
        </m.span>
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
      ref={stageRef}
      className="tangents-stage"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: ((e.clientX - rect.left) / rect.width - 0.5) * 120,
          y: ((e.clientY - rect.top) / rect.height - 0.5) * 120,
          scale: 1,
        };
      }}
    >
      <PathAmbient read={readPointer} reduced={reduced} />

      {asList ? (
        <ul className="tangents-list" aria-label="Your paths">
          {paths.map((path, i) => {
            const when = formatDeadline(path.deadline);
            return (
              <m.li
                key={path.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 + Math.min(i * 0.06, 0.4) }}
              >
                <Link href={`/tangents/${path.id}`} className="tangents-row">
                  <Disc progress={progressOf(path)} size={48} delay={0.1 + i * 0.06} reduced={reduced} />
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
              style={
                {
                  width: box.w,
                  height: box.h,
                  transform: `scale(${scale})`,
                  "--ox": `${box.ox}px`,
                  "--oy": `${box.oy}px`,
                } as React.CSSProperties
              }
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
                    {/* Drawn once as a line, then left as a slow dashed drift. */}
                    <m.circle
                      className="tangents-orbit-draw"
                      cx={RING_RADIUS + 2}
                      cy={RING_RADIUS + 2}
                      r={RING_RADIUS}
                      initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 1.4, ease: EASE_OUT, opacity: { times: [0, 0.1, 0.7, 1], duration: 1.8 } }}
                    />
                    <m.circle
                      className="tangents-orbit-dash"
                      cx={RING_RADIUS + 2}
                      cy={RING_RADIUS + 2}
                      r={RING_RADIUS}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 1.1 }}
                    />
                  </svg>
                  <m.div
                    className="tangents-hub"
                    style={{ left: box.ox, top: box.oy }}
                    aria-hidden="true"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(6px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    transition={{ type: "spring", visualDuration: 0.7, bounce: 0.25, delay: 0.1 }}
                  >
                    <span className="tangents-hub-mark">
                      <TangentLogo variant="mark" size={40} />
                    </span>
                    <span>{paths.length} paths</span>
                  </m.div>
                </>
              )}

              {placed.map(({ path, at }, i) => (
                <Sphere key={path.id} path={path} index={i} at={at} reduced={reduced} onOpen={open} />
              ))}
            </div>
          </div>
        )
      )}

      {/* The way in: the path's own dark widens out of the disc you pressed,
          and the route changes underneath it once it has covered the screen. */}
      <AnimatePresence>
        {portal && (
          <m.div
            key="portal"
            className="tangents-portal"
            style={{ "--px": `${portal.x}px`, "--py": `${portal.y}px` } as React.CSSProperties}
            initial={{ clipPath: `circle(0px at ${portal.x}px ${portal.y}px)` }}
            animate={{ clipPath: `circle(150vmax at ${portal.x}px ${portal.y}px)` }}
            transition={{ duration: 0.6, ease: [0.7, 0, 0.2, 1] }}
            onAnimationComplete={() => router.push(`/tangents/${portal.id}`)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
