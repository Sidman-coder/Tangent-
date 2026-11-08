"use client";

// "Help Tangent plan better", under a confirmed plan: the nice-to-have questions
// it earned. What goes unanswered waits on Today. Nothing shows if there's
// nothing worth asking.

import { useEffect, useRef, useState } from "react";
import GrillDeck from "@/components/grill/GrillDeck";
import { seedGrill } from "@/lib/grill-client";
import type { GrillItem } from "@/lib/grill-queue";

export default function HelpPlanBetter({
  planId,
  said,
  asked,
  onDone,
}: {
  planId: string;
  /** The student's own words: never ask what they already said. */
  said: string;
  /** Questions already asked before the preview; they use up the budget. */
  asked: number;
  onDone: () => void;
}) {
  const [items, setItems] = useState<GrillItem[] | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void seedGrill(planId, said, asked).then((queued) => {
      setItems(queued);
      if (queued.length === 0) doneRef.current();
    });
  }, [planId, said, asked]);

  if (!items || items.length === 0) return null;
  return (
    <div className="grill-help">
      <p className="grill-help-title">Help Tangent plan better</p>
      <GrillDeck items={items} onDone={() => doneRef.current()} />
    </div>
  );
}
