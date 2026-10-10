"use client";

import "@/components/get-to-know-you.css";

// On Today, until Tangent knows a little about the student: one quiet line
// offering the Get to know you conversation. "Not now" hides it on this
// browser; it also disappears once Tangent knows a handful of things.

import { useEffect, useState } from "react";
import { GET_TO_KNOW_DONE_EVENT, GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";
import { TOUR_DONE_KEY } from "@/components/FeatureTour";

const DISMISS_KEY = "tangent-gtk-nudge-dismissed";
const ENOUGH_FACTS = 4;

export default function GetToKnowNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    let toured = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      toured = window.localStorage.getItem(TOUR_DONE_KEY) === "1";
    } catch {}
    // One nudge at a time on Today: the tour's comes first.
    if (dismissed || !toured) return;
    const check = () =>
      void fetch("/api/context", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { context?: { entries?: unknown[] } }) => setShow((d.context?.entries?.length ?? 0) < ENOUGH_FACTS))
        .catch(() => {});
    check();
    window.addEventListener(GET_TO_KNOW_DONE_EVENT, check);
    return () => window.removeEventListener(GET_TO_KNOW_DONE_EVENT, check);
  }, []);

  if (!show) return null;
  return (
    <section className="gtk-nudge" aria-label="Let Tangent get to know you">
      <div>
        <strong>Let Tangent get to know you</strong>
        <span>Six quick questions, so every plan fits you. About two minutes.</span>
      </div>
      <button type="button" className="gtk-nudge-start" onClick={() => window.dispatchEvent(new Event(GET_TO_KNOW_EVENT))}>
        Start
      </button>
      <button
        type="button"
        className="gtk-nudge-later"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
          setShow(false);
        }}
      >
        Not now
      </button>
    </section>
  );
}
