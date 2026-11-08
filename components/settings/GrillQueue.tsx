"use client";

// Settings → Onboarding → Grill me: the full queue, and "Grill me now" to answer
// it, up to SESSION_BUDGET at a time. With nothing queued it asks fresh ones.

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import GrillDeck from "@/components/grill/GrillDeck";
import { GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";
import { useGrillQueue } from "@/hooks/useGrillQueue";
import { SESSION_BUDGET, rankQueue } from "@/lib/grill-queue";
import "@/components/grill/grill.css";

export default function GrillQueue() {
  const { items } = useGrillQueue();
  const open = useMemo(() => rankQueue(items), [items]);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <div className="settings-row">
        <div className="settings-row-copy">
          <strong>Grill me</strong>
          <span>
            {open.length > 0
              ? `${open.length} question${open.length === 1 ? "" : "s"} waiting. Tangent asks a few at a time, and only what would change a plan.`
              : "Nothing waiting. Tangent can ask a few sharp questions now. Answer out loud or tap."}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (open.length > 0) setAsking(true);
            else window.dispatchEvent(new CustomEvent(GET_TO_KNOW_EVENT, { detail: { mode: "grill" } }));
          }}
          disabled={asking}
        >
          Grill me now
        </Button>
      </div>
      {asking ? (
        <div className="grill-queue-deck">
          <GrillDeck items={open} max={SESSION_BUDGET} onDone={() => setAsking(false)} />
        </div>
      ) : (
        open.length > 0 && (
          <ul className="grill-queue-list" aria-label="Questions waiting">
            {open.map((q) => (
              <li key={q.id}>{q.question}</li>
            ))}
          </ul>
        )
      )}
    </>
  );
}
