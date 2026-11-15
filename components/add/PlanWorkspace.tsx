"use client";

// Round 5A 2.3: Home's planning split, once round 1 is placed. The brief on
// the left (the talk so far, the step cards, Confirm / Edit / Discard, and the
// composer); the calendar on the right, bigger, with nothing under it. On a
// phone the panes sit behind Brief / Calendar tabs. AddFlow owns the state;
// this only lays it out.

import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

export type Pane = "brief" | "calendar";

export function CalendarPlaceholder({ working }: { working: boolean }) {
  return (
    <div className="plan-ws-cal-empty">
      <CalendarDays size={22} strokeWidth={1.75} aria-hidden="true" />
      <p>{working ? "Placing round 1 on your calendar…" : "Round 1 shows here once Tangent has planned it."}</p>
    </div>
  );
}

const LABEL: Record<Pane, string> = { brief: "Brief", calendar: "Calendar" };

export default function PlanWorkspace({
  head,
  pane,
  onPane,
  brief,
  calendar,
}: {
  head: ReactNode;
  pane: Pane;
  onPane: (p: Pane) => void;
  brief: ReactNode;
  calendar: ReactNode;
}) {
  return (
    <>
      {head}
      <div className="plan-ws-tabs" role="tablist" aria-label="Plan">
        {(["brief", "calendar"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`plan-ws-tab-${p}`}
            aria-selected={pane === p}
            aria-controls={`plan-ws-pane-${p}`}
            className={pane === p ? "is-on" : ""}
            onClick={() => onPane(p)}
          >
            {LABEL[p]}
          </button>
        ))}
      </div>
      <div className="plan-ws-panes">
        <div className="plan-ws-left" id="plan-ws-pane-brief" role="tabpanel" aria-labelledby="plan-ws-tab-brief" data-active={pane === "brief"}>
          {brief}
        </div>
        <div className="plan-ws-right" id="plan-ws-pane-calendar" role="tabpanel" aria-labelledby="plan-ws-tab-calendar" data-active={pane === "calendar"}>
          {calendar}
        </div>
      </div>
    </>
  );
}
