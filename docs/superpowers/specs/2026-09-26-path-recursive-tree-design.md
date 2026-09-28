# Path: the recursive tree

**Date:** 2026-09-26
**Status:** built

## What it is

One rule, applied at every depth:

- A **circle** has a centre. The root circle's centre is the college goal.
- **Members** sit ON the circle: the work the student already has.
- From each member, a **tangent** leaves the circle at exactly that point and
  ends in an **idea**. Tangents are the only green thing on the page.
- An idea that is kept becomes the **centre of its own circle**, and the rule
  repeats. That recursion is the tree.

The geometry is the product, so it is computed rather than simulated. Every line
is a true tangent: perpendicular to the radius at its touch point. A force
layout would drift the lines off the circles and the drawing would stop meaning
anything.

Note the deliberate inversion from the original logo story. With the college at
the centre, tangents now travel outward from it rather than toward it. The
college is the gravity everything orbits, and ideas explore outward from the
same centre.

## Data model

`Anchor` and `TangentIdea` collapsed into one recursive `PathNode`
(`lib/types.ts`): `id`, `parentId`, `kind`, plus the existing detail fields.
Depth decides what a node is, and the server derives it, so the client never has
to get it right:

| depth | kind | drawn as |
|-------|------|----------|
| 0 | the goal | centre of the root circle |
| 1 | work | a point on that circle |
| 2 | idea | the far end of a tangent |
| 3 | work | a point on the circle grown from that idea |

Workspaces saved under the old flat shape migrate on first read
(`space()` in `lib/store.ts`); nothing is lost and nothing has to be redeployed.

## Modules

- `lib/path-layout.ts` - pure geometry. No React, no DOM. Unit-tested on its own
  for the invariants the whole premise rests on: members lie exactly on their
  circle, tangents are perpendicular at their touch point, a tangent never
  re-enters the circle, and the recursion holds at depth.
- `app/api/path/route.ts` - goal, node CRUD, and generation. Generation sends
  Claude the whole ancestor chain, so a branch four levels down is still drafted
  against the college.
- `components/path/usePathCamera.ts` - pan, zoom, and fly-to.
- `components/path/PathScene.tsx` - three layers sharing one camera: canvas for
  ambient depth, SVG for exact geometry, HTML for crisp accessible labels.
- `components/path/PathInspector.tsx` - everything readable about one node.
  Sentences on the drawing were what made the previous version unreadable.

## Two decisions worth keeping

**The camera does not use React state or Motion values.** React state is wrong
because a drag updates the camera every pointer frame. Motion values were tried
and, under this app's `LazyMotion` setup, only reached the DOM when React
happened to re-render. The camera owns a ref, integrates its own spring, and
writes a transform plus a `--path-zoom` custom property. Labels counter-scale
off that variable in CSS, so one property write resizes every label with no
per-node subscription.

**Fit reserves room for labels in screen pixels, not world units.** Labels are
counter-scaled, so their size in world units changes with the zoom. Padding the
layout bounds for them makes fitting a fixed-point problem that never settles.

## Testing

- `test-geometry.mjs` - 22 checks on the layout invariants.
- `test-workspaces.mjs` - 35 checks across two server instances sharing one
  store, covering the Path API, depth alternation, subtree deletion, and
  workspace isolation.
