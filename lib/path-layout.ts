// The geometry of Path.
//
// One rule, applied at every depth:
//
//   A circle has a centre. Its members sit ON the circle. From each member a
//   tangent leaves the circle at exactly that point and ends in an idea. An
//   idea you keep becomes the centre of its own circle, and the rule repeats.
//
// Every line drawn is a true tangent - perpendicular to the radius at its touch
// point - which is why this is computed rather than simulated. A force layout
// would drift the lines off the circles and the drawing would stop meaning
// anything. The trade is that placement has to avoid collisions by construction,
// which is what the sector arithmetic below is for.
//
// Pure functions, no React, no DOM: this module is unit-tested on its own.

import type { PathNode } from "./types";

export type Vec = { x: number; y: number };

export type LaidCircle = {
  /** The node at the centre. The root circle's centre is the goal. */
  id: string;
  node: PathNode | null;
  center: Vec;
  radius: number;
  depth: number;
  /** Direction this circle grew from, in radians. Its members fan around it. */
  facing: number;
};

export type LaidMember = {
  node: PathNode;
  circleId: string;
  point: Vec;
  /** Angle on its circle, radians. */
  angle: number;
  depth: number;
};

export type LaidTangent = {
  node: PathNode;
  /** The member this branches off. */
  memberId: string;
  /** Where the line touches the circle. */
  touch: Vec;
  end: Vec;
  /** Unit direction from touch to end. */
  dir: Vec;
  depth: number;
};

export type PathLayout = {
  circles: LaidCircle[];
  members: LaidMember[];
  tangents: LaidTangent[];
  /** Every positioned node, for hit-testing and camera moves. */
  points: Map<string, Vec>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

export const ROOT_RADIUS = 190;
/** Each generation's circle is smaller, so depth reads as scale. */
const RADIUS_DECAY = 0.62;
const MIN_RADIUS = 54;
/** Tangent length relative to the radius it leaves. */
const TANGENT_REACH = 2.05;
/** Angular offset between sibling ideas leaving the same member, radians. */
const IDEA_FAN = 0.26;
/** Siblings also reach different distances, so three branches off one member
 *  spread in two dimensions instead of landing in a row. */
const IDEA_REACH_STEP = 0.34;
/** A child circle may use this much of the compass, radians. Kept under a full
 *  half-turn so a grown circle's members stay ahead of the direction it was
 *  travelling rather than folding back across the branch that made it. */
const CHILD_SPAN = Math.PI * 0.92;

const TAU = Math.PI * 2;

function norm(angle: number): number {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

function onCircle(center: Vec, radius: number, angle: number): Vec {
  return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/**
 * The unit tangent at `angle`, pointing away from `facing`.
 *
 * Both tangents at a point are geometrically valid; picking the one that leans
 * away from the direction the circle grew from is what makes the tree splay
 * outward instead of curling back over itself.
 */
function tangentDir(angle: number, facing: number): Vec {
  const ccw = { x: -Math.sin(angle), y: Math.cos(angle) };
  const side = norm(angle - facing);
  return side >= 0 ? ccw : { x: -ccw.x, y: -ccw.y };
}

/** Children of `id`, in stable creation order. */
function childrenOf(nodes: PathNode[], id: string | null): PathNode[] {
  return nodes.filter((n) => n.parentId === id && n.status !== "dismissed");
}

type Ctx = {
  nodes: PathNode[];
  circles: LaidCircle[];
  members: LaidMember[];
  tangents: LaidTangent[];
  points: Map<string, Vec>;
  /** Ideas the viewer has opened. A closed idea is a leaf and draws no circle. */
  expanded: Set<string>;
  maxDepth: number;
};

/**
 * Lays out one circle: places its members around `facing`, draws each member's
 * tangents, and recurses into any idea that has been opened.
 */
function layoutCircle(
  ctx: Ctx,
  centerNode: PathNode | null,
  centerId: string,
  center: Vec,
  radius: number,
  facing: number,
  depth: number
): void {
  ctx.circles.push({ id: centerId, node: centerNode, center, radius, depth, facing });
  ctx.points.set(centerId, center);

  const members = childrenOf(ctx.nodes, centerNode ? centerNode.id : null);
  if (members.length === 0) return;

  // The root faces up and uses the whole compass; a grown circle keeps its
  // members on the side it is heading, so it never doubles back over its parent.
  const span = depth === 0 ? TAU : CHILD_SPAN;
  const step = depth === 0 ? TAU / members.length : span / (members.length + 1);
  const start = depth === 0 ? facing : facing - span / 2 + step;

  members.forEach((member, i) => {
    const angle = start + i * step;
    const point = onCircle(center, radius, angle);
    ctx.members.push({ node: member, circleId: centerId, point, angle, depth: depth + 1 });
    ctx.points.set(member.id, point);

    const ideas = childrenOf(ctx.nodes, member.id);
    if (ideas.length === 0) return;

    // Each idea leaves from its own touch point, fanned a few degrees apart, so
    // a member with three ideas shows three real tangents rather than three
    // beads threaded on one line.
    const fanStart = -((ideas.length - 1) / 2) * IDEA_FAN;
    const reach = radius * TANGENT_REACH;

    ideas.forEach((idea, j) => {
      const touchAngle = angle + fanStart + j * IDEA_FAN;
      const touch = onCircle(center, radius, touchAngle);
      const dir = tangentDir(touchAngle, facing);
      const reachOut = reach * (1 + j * IDEA_REACH_STEP);
      const end = { x: touch.x + reachOut * dir.x, y: touch.y + reachOut * dir.y };

      ctx.tangents.push({ node: idea, memberId: member.id, touch, end, dir, depth: depth + 2 });
      ctx.points.set(idea.id, end);

      // An opened idea becomes the centre of the next circle, facing the way
      // its tangent was already travelling.
      const grows = ctx.expanded.has(idea.id) && childrenOf(ctx.nodes, idea.id).length > 0;
      if (grows && depth + 2 < ctx.maxDepth) {
        layoutCircle(
          ctx,
          idea,
          idea.id,
          end,
          Math.max(radius * RADIUS_DECAY, MIN_RADIUS),
          Math.atan2(dir.y, dir.x),
          depth + 2
        );
      }
    });
  });
}

export function layoutPath(
  nodes: PathNode[],
  options: { expanded?: Iterable<string>; maxDepth?: number } = {}
): PathLayout {
  const ctx: Ctx = {
    nodes,
    circles: [],
    members: [],
    tangents: [],
    points: new Map(),
    expanded: new Set(options.expanded ?? []),
    maxDepth: options.maxDepth ?? 12,
  };

  // The goal is the root centre and has no node of its own in the tree: it is
  // the Goal record, and its children are the work on the first circle.
  layoutCircle(ctx, null, "goal", { x: 0, y: 0 }, ROOT_RADIUS, -Math.PI / 2, 0);

  let minX = -ROOT_RADIUS;
  let minY = -ROOT_RADIUS;
  let maxX = ROOT_RADIUS;
  let maxY = ROOT_RADIUS;
  const stretch = (p: Vec, padX: number, padY: number) => {
    minX = Math.min(minX, p.x - padX);
    minY = Math.min(minY, p.y - padY);
    maxX = Math.max(maxX, p.x + padX);
    maxY = Math.max(maxY, p.y + padY);
  };
  // The padding is for the labels, which are HTML and sit outside this module's
  // knowledge. A node is a point here but a card on screen, so bounds computed
  // from points alone zoom in too far and clip the outermost cards.
  // Geometry only. Labels are deliberately NOT accounted for here: they are
  // counter-scaled, so their size in world units changes with the zoom, and
  // padding these bounds for them makes fitting a fixed-point problem that
  // never quite converges. The camera reserves room for them in screen pixels
  // instead - see `fit` in usePathCamera.
  for (const c of ctx.circles) stretch(c.center, c.radius, c.radius);
  for (const m of ctx.members) stretch(m.point, 0, 0);
  for (const t of ctx.tangents) stretch(t.end, 0, 0);

  return { ...ctx, bounds: { minX, minY, maxX, maxY } };
}

/** True when `point` lies on the circle it claims to, within `tolerance`. */
export function isOnCircle(point: Vec, center: Vec, radius: number, tolerance = 0.001): boolean {
  const d = Math.hypot(point.x - center.x, point.y - center.y);
  return Math.abs(d - radius) <= tolerance;
}

/** True when the touch-to-end direction is perpendicular to the radius. */
export function isTangential(touch: Vec, dir: Vec, center: Vec, tolerance = 0.001): boolean {
  const radial = { x: touch.x - center.x, y: touch.y - center.y };
  const len = Math.hypot(radial.x, radial.y) || 1;
  const dot = (radial.x / len) * dir.x + (radial.y / len) * dir.y;
  return Math.abs(dot) <= tolerance;
}
