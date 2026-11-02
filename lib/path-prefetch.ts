// Opening a path from the gallery: its data starts loading the moment the
// disc is pressed, so by the time the reveal has covered the screen the path
// page can draw straight away around the goal card that flew to the middle,
// instead of cutting to a loading skeleton. Client only; same GET /api/path.

import type { Path, PathNode, PathNodeSchedule } from "./types";

export type PathData = { path: Path; nodes: PathNode[]; scheduled?: Record<string, PathNodeSchedule> };

const cache = new Map<string, { at: number; data?: PathData; promise: Promise<PathData | null> }>();
const FRESH_MS = 15_000;

export function prefetchPath(id: string): Promise<PathData | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.promise;
  const entry: { at: number; data?: PathData; promise: Promise<PathData | null> } = {
    at: Date.now(),
    promise: Promise.resolve(null),
  };
  entry.promise = fetch(`/api/path?pathId=${encodeURIComponent(id)}`, { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<PathData>) : null))
    .then((data) => {
      if (data?.path) entry.data = data;
      return data?.path ? data : null;
    })
    .catch(() => null);
  cache.set(id, entry);
  return entry.promise;
}

/** The prefetched data if it has already arrived, once. */
export function takePrefetchedPath(id: string): PathData | null {
  const hit = cache.get(id);
  if (!hit?.data || Date.now() - hit.at > FRESH_MS) return null;
  cache.delete(id);
  return hit.data;
}
