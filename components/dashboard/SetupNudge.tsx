"use client";

// One slim line on Today until Tangent is set up: the tour, its first
// questions, and context from other AIs all live in Settings → Onboarding.
// Replaces the separate tour and get-to-know-you cards.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { TOUR_ACTIVE_KEY, TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";

const DISMISS_KEY = "tangent-setup-nudge-dismissed";
const ENOUGH_FACTS = 4;

export default function SetupNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let toured = false;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
      if (window.sessionStorage.getItem(TOUR_ACTIVE_KEY) === "1") return;
      toured = window.localStorage.getItem(TOUR_DONE_KEY) === "1";
    } catch {}
    if (!toured) {
      setShow(true);
    } else {
      void fetch("/api/context", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { context?: { entries?: unknown[] } }) => setShow((d.context?.entries?.length ?? 0) < ENOUGH_FACTS))
        .catch(() => {});
    }
    const hide = () => setShow(false);
    window.addEventListener(TOUR_EVENT, hide);
    return () => window.removeEventListener(TOUR_EVENT, hide);
  }, []);

  if (!show) return null;
  // Compact, beside the page title: it shouldn't push the day down.
  return (
    <div className="setup-nudge" role="note">
      <Link href="/settings#onboarding" className="setup-nudge-go" title="A two-minute tour and a few questions so Tangent fits you">
        Finish setting up <ArrowRight size={13} aria-hidden="true" />
      </Link>
      <button
        type="button"
        className="setup-nudge-close"
        aria-label="Hide"
        onClick={() => {
          setShow(false);
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
        }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
