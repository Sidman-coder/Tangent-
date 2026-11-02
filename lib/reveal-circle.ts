// The lavender takeover's clip-path, grown from a point (the mic island, the
// Start button). Both ends must be in pixels around the same centre: with
// mixed units (0px → 150vmax) motion can't interpolate the shape cleanly and
// the centre drifts, which on a large full-screen window made the wash
// appear to start nowhere near the island.

export type Point = { x: number; y: number };

export function revealCircle(at: Point, viewport: { width: number; height: number }): { from: string; to: string } {
  const dx = Math.max(at.x, viewport.width - at.x);
  const dy = Math.max(at.y, viewport.height - at.y);
  const r = Math.ceil(Math.hypot(dx, dy));
  const centre = `at ${Math.round(at.x)}px ${Math.round(at.y)}px`;
  return { from: `circle(0px ${centre})`, to: `circle(${r}px ${centre})` };
}
