"use client";

// Round 5A 2.2: the real planning steps, shown as they start. Each id comes
// from /api/chat as {type:"stage"} when lib/voice-handler.ts begins that step,
// so nothing here is a timer pretending to work.

import { Check } from "lucide-react";
import type { PlanStage } from "@/lib/voice-handler";

const STAGES: { id: PlanStage; label: string }[] = [
  { id: "week", label: "Reading your week" },
  { id: "facts", label: "Checking what you've told me" },
  { id: "steps", label: "Choosing steps" },
  { id: "place", label: "Placing them" },
];

export default function ThinkingStages({ current }: { current: PlanStage | null }) {
  const at = current ? STAGES.findIndex((s) => s.id === current) : -1;
  return (
    <ol className="plan-stages" role="status" aria-live="polite" aria-label="Planning">
      {STAGES.map((s, i) => {
        const state = i < at ? "done" : i === at ? "now" : "next";
        return (
          <li key={s.id} className={`plan-stage is-${state}`}>
            <span className="plan-stage-mark" aria-hidden="true">
              {state === "done" ? <Check size={14} strokeWidth={1.75} /> : state === "now" ? <span className="add-spinner" /> : null}
            </span>
            <span>{s.label}</span>
            {state === "done" && <span className="sr-only">, done</span>}
          </li>
        );
      })}
    </ol>
  );
}
