"use client";

// Settings → Your Tangent: the tour, right under You, mapped, so someone new
// finds it before anything else on the page.

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Status } from "@/components/settings/OnboardingSection";
import { TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";

export default function TourCard() {
  const [toured, setToured] = useState(false);
  useEffect(() => {
    try {
      setToured(window.localStorage.getItem(TOUR_DONE_KEY) === "1");
    } catch {}
  }, []);

  return (
    <section id="tour" className="settings-group" aria-label="Take the tour">
      <div className="settings-card">
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Take the tour</strong>
            <span>A two-minute walk through adding, the calendar, projects and Ask Tangent.</span>
            <Status done={toured}>{toured ? "Done" : "Not yet"}</Status>
          </div>
          <Button size="sm" variant={toured ? "secondary" : "primary"} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
            {toured ? "Take it again" : "Start tour"}
          </Button>
        </div>
      </div>
    </section>
  );
}
