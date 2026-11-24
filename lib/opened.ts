// "Last opened" on the client. Opening a project or a Tangent tells the server
// (POST /api/opened, which stamps last_opened_at) and tells this tab at once,
// so the sidebar moves it to the top without waiting for a reload.

import { useEffect, useState } from "react";
import type { OpenedNow } from "./sidebar-recents";

export const OPENED_EVENT = "tangent:opened";
export type OpenedDetail = { kind: "project" | "tangent"; id: string; at: string };

// Kept for the life of the tab: a page's effects run before the sidebar's on a
// fresh load, so an event alone could fire before anyone is listening.
let openedThisTab: OpenedNow = {};

export function noteOpened(kind: OpenedDetail["kind"], id: string): void {
  const detail: OpenedDetail = { kind, id, at: new Date().toISOString() };
  openedThisTab = { ...openedThisTab, [`${kind}:${id}`]: detail.at };
  window.dispatchEvent(new CustomEvent<OpenedDetail>(OPENED_EVENT, { detail }));
  void fetch("/api/opened", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id }),
    keepalive: true,
  }).catch(() => {});
}

/** Records one open each time the page shows a different project or Tangent. */
export function useNoteOpened(kind: OpenedDetail["kind"], id: string | null | undefined): void {
  useEffect(() => {
    if (id) noteOpened(kind, id);
  }, [kind, id]);
}

/** This tab's opens, for recentProjectsAndTangents. */
export function useOpenedNow(): OpenedNow {
  const [opened, setOpened] = useState<OpenedNow>(openedThisTab);
  useEffect(() => {
    // Catch anything opened between the first render and this effect.
    setOpened(openedThisTab);
    const handle = () => setOpened(openedThisTab);
    window.addEventListener(OPENED_EVENT, handle);
    return () => window.removeEventListener(OPENED_EVENT, handle);
  }, []);
  return opened;
}
