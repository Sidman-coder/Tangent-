"use client";

// How much of "Finish setting up" is left: the tour, and enough for Tangent to
// know about the student. Hidden while the tour runs, or once dismissed.

import { useCallback, useEffect, useState } from "react";
import { TOUR_ACTIVE_KEY, TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";

const DISMISS_KEY = "tangent-setup-nudge-dismissed";
const ENOUGH_FACTS = 4;

export function useSetupLeft(): { left: number; hide: () => void } {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let toured = false;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      if (window.sessionStorage.getItem(TOUR_ACTIVE_KEY) === "1") return;
      toured = window.localStorage.getItem(TOUR_DONE_KEY) === "1";
    } catch {}
    const tourLeft = toured ? 0 : 1;
    setLeft(tourLeft);
    let live = true;
    void fetch("/api/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { context?: { entries?: unknown[] } }) => {
        if (live && (d.context?.entries?.length ?? 0) < ENOUGH_FACTS) setLeft(tourLeft + 1);
      })
      .catch(() => {});
    const hide = () => setLeft(0);
    window.addEventListener(TOUR_EVENT, hide);
    return () => {
      live = false;
      window.removeEventListener(TOUR_EVENT, hide);
    };
  }, []);

  const hide = useCallback(() => {
    setLeft(0);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }, []);

  return { left, hide };
}
