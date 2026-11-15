"use client";

// The student's Tangents (GET /api/path), shared by the sidebar's Projects
// list, the Projects page and /tangents, so all three show the same list and
// a reload in one updates the others. Client only.

import { useEffect, useState } from "react";
import type { Path } from "@/lib/types";

export type PathWithCounts = Path & {
  counts: { work: number; ideas: number; kept: number; done: number };
};

type Snapshot = { paths: PathWithCounts[] | null; error: string | null };

let snapshot: Snapshot = { paths: null, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: Snapshot) => void>();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((fn) => fn(snapshot));
}

/** Fetches the list again; calls made while one is in flight share it. */
export function loadTangents(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/path", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load your Tangents (${res.status})`);
      const data = (await res.json()) as { paths?: PathWithCounts[] };
      publish({ paths: data.paths ?? [], error: null });
    } catch (e) {
      publish({ paths: snapshot.paths ?? [], error: e instanceof Error ? e.message : "Couldn't load your Tangents." });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The list, loaded fresh when the component mounts. */
export function useTangents() {
  const [state, setState] = useState<Snapshot>(snapshot);
  useEffect(() => {
    listeners.add(setState);
    setState(snapshot);
    void loadTangents();
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return { paths: state.paths, error: state.error, reload: loadTangents };
}
