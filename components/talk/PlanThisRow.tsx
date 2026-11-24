"use client";

// Round 5A 2.1: under an answer about a goal, the one way to turn talk into a
// plan. "Not now" just hides it; the talk carries on either way.

import { CalendarPlus } from "lucide-react";
import Button from "@/components/ui/Button";

export default function PlanThisRow({ onPlan, onDismiss, disabled }: { onPlan: () => void; onDismiss: () => void; disabled?: boolean }) {
  return (
    <div className="talk-plan-row">
      <span className="talk-plan-ask">Want me to plan it?</span>
      <Button variant="secondary" size="sm" icon={<CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={onPlan} disabled={disabled}>
        Plan this into my calendar
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss} disabled={disabled}>
        Not now
      </Button>
    </div>
  );
}
