"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvasFeedStatus } from "@/lib/types";

/** Masked Canvas feed status; the real .ics URL never leaves the server.
 *  `loaded` stays false until the call answers, so nobody sees a wrong
 *  "Not connected" first. */
const SYNC_FLAG = "tangent.canvas.syncFailed";
const SYNC_EVENT = "tangent:canvas-sync";

/** Remembered for this tab only: the quiet retry already ran, so a failure here
 *  is worth one plain message. A later good sync clears it. */
export function setCanvasSyncFailed(failed: boolean): void {
  try {
    if (failed) sessionStorage.setItem(SYNC_FLAG, "1");
    else sessionStorage.removeItem(SYNC_FLAG);
  } catch {
    /* storage blocked: the message just won't show */
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

function readSyncFailed(): boolean {
  try {
    return sessionStorage.getItem(SYNC_FLAG) === "1";
  } catch {
    return false;
  }
}

export function useCanvasStatus() {
  const [feed, setFeed] = useState<CanvasFeedStatus | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  useEffect(() => {
    const read = () => setSyncFailed(readSyncFailed());
    read();
    window.addEventListener(SYNC_EVENT, read);
    return () => window.removeEventListener(SYNC_EVENT, read);
  }, []);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    fetch("/api/canvas/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; feed?: CanvasFeedStatus | null }) => setFeed(data.ok ? data.feed ?? null : null))
      .catch(() => setFeed(null))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(reload, [reload]);
  return { connected: Boolean(feed), loaded, reload, syncFailed: Boolean(feed) && syncFailed, itemCount: feed?.itemCount ?? 0 };
}
