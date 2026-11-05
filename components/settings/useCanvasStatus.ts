"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvasFeedStatus } from "@/lib/types";

/** Masked Canvas feed status; the real .ics URL never leaves the server.
 *  `loaded` stays false until the call answers, so nobody sees a wrong
 *  "Not connected" first. */
export function useCanvasStatus() {
  const [feed, setFeed] = useState<CanvasFeedStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    fetch("/api/canvas/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; feed?: CanvasFeedStatus | null }) => setFeed(data.ok ? data.feed ?? null : null))
      .catch(() => setFeed(null))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(reload, [reload]);
  return { connected: Boolean(feed), loaded, reload };
}
