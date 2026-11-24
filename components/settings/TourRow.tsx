"use client";

// "Take the tour", moved from What Tangent knows to Help: the tour is about
// using the app, not about what Tangent knows about you.
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import SettingRow from "@/components/ui/SettingRow";
import { TOUR_DONE_KEY, TOUR_EVENT } from "@/components/FeatureTour";

export default function TourRow() {
  const [toured, setToured] = useState(false);
  useEffect(() => {
    try {
      setToured(window.localStorage.getItem(TOUR_DONE_KEY) === "1");
    } catch {}
  }, []);
  return (
    <SettingRow label="Take the tour" help="A two-minute walk through adding, the calendar, projects and Ask Tangent.">
      <Button size="sm" variant={toured ? "secondary" : "primary"} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
        {toured ? "Take it again" : "Start tour"}
      </Button>
    </SettingRow>
  );
}
