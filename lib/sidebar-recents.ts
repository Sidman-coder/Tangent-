// The sidebar's Projects list (components/AppShell.tsx): projects and Tangents
// together, the ones the student opened most recently first, so their usual
// ones stay in reach. Anything never opened sorts by when it was made.

export const SIDEBAR_RECENTS = 7;

type Dated = { id: string; title: string; createdAt: string; lastOpenedAt?: string };

export type RecentItem<P extends Dated = Dated, T extends Dated = Dated> =
  | { kind: "project"; id: string; title: string; at: number; item: P }
  | { kind: "tangent"; id: string; title: string; at: number; item: T };

/** Opens made in this tab that the server list doesn't show yet, keyed
 *  "project:<id>" or "tangent:<id>". */
export type OpenedNow = Record<string, string>;

/** A bad or missing date reads as the oldest, so it can't break the order. */
function time(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function recency(kind: "project" | "tangent", d: Dated, opened: OpenedNow | undefined): number {
  return Math.max(time(d.lastOpenedAt), time(opened?.[`${kind}:${d.id}`]), time(d.createdAt));
}

export function recentProjectsAndTangents<P extends Dated, T extends Dated>(
  plans: readonly P[] | null | undefined,
  paths: readonly T[] | null | undefined,
  opened?: OpenedNow,
  limit = SIDEBAR_RECENTS,
): RecentItem<P, T>[] {
  const all: RecentItem<P, T>[] = [
    ...(plans ?? []).map((p) => ({ kind: "project" as const, id: p.id, title: p.title, at: recency("project", p, opened), item: p })),
    ...(paths ?? []).map((t) => ({ kind: "tangent" as const, id: t.id, title: t.title, at: recency("tangent", t, opened), item: t })),
  ];
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}
