"use client";

// One quiet line on Today until the student has seen the tour (or said not
// now): there's a lot in Tangent, and this is the two-minute way to see it.

import { useEffect, useState } from "react";
import { TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";
import "@/components/feature-tour.css";
import "@/components/get-to-know-you.css";

export default function TourNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(TOUR_DONE_KEY) !== "1");
    } catch {}
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {}
    setShow(false);
  };
  return (
    <section className="tour-nudge" aria-label="Take the tour">
      <div>
        <strong>New here, or new features?</strong>
        <span>A two-minute tour of everything Tangent does.</span>
      </div>
      <button
        type="button"
        className="gtk-nudge-start"
        onClick={() => {
          setShow(false);
          window.dispatchEvent(new Event(TOUR_EVENT));
        }}
      >
        Take the tour
      </button>
      <button type="button" className="gtk-nudge-later" onClick={dismiss}>
        Not now
      </button>
    </section>
  );
}
