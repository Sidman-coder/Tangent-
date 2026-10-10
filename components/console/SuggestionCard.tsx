"use client";

// One move the spacing brain suggests when a day is over the student's load
// (lib/load.ts suggestRelief). Nothing moves until they tap; the move goes
// through /api/reschedule, which records it so Undo works.

import { useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import "./suggestion-card.css";
import "./clarify-card.css";

export type Suggestion = {
  taskId: string;
  title: string;
  toDate: string;
  toTime: string;
  message: string;
};

type Props = { suggestion: Suggestion; onMoved: () => void };

export default function SuggestionCard({ suggestion, onMoved }: Props) {
  const [state, setState] = useState<"open" | "moving" | "moved" | "kept" | "error">("open");
  const [actionId, setActionId] = useState<string | null>(null);

  if (state === "kept") return null;

  const accept = async () => {
    setState("moving");
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: suggestion.taskId, suggestedDate: suggestion.toDate, suggestedTime: suggestion.toTime }),
      });
      const data = (await res.json()) as { ok?: boolean; actionId?: string };
      if (!res.ok || !data.ok) throw new Error();
      setActionId(data.actionId ?? null);
      setState("moved");
      onMoved();
    } catch {
      setState("error");
    }
  };

  if (state === "moved" && actionId) {
    return (
      <div className="tg-suggest is-done">
        <ActionReceipt actionId={actionId} label={`Moved "${suggestion.title}".`} onUndone={onMoved} />
      </div>
    );
  }

  return (
    <div className="tg-suggest">
      <p>{state === "error" ? "Couldn't move it. It may have changed — try from the calendar." : suggestion.message}</p>
      {state !== "error" && (
        <div className="tg-suggest-actions">
          <button type="button" className="tg-clarify-btn is-primary" onClick={() => void accept()} disabled={state === "moving"}>
            {state === "moving" ? "Moving…" : "Move it"}
          </button>
          <button type="button" className="tg-clarify-btn" onClick={() => setState("kept")} disabled={state === "moving"}>
            Keep it
          </button>
        </div>
      )}
    </div>
  );
}
