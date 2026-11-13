"use client";

// Round 4 §3.4: the round review card. At about 70% of a round done, or once
// its week is over: one plain summary of how it went (from check-in codes),
// then the next round proposed as a draft the student confirms or drops. On
// Confirm the project moves to the next round; Undo on the preview takes the
// steps back out.

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Button from "@/components/ui/Button";
import PreviewCard from "@/components/PreviewCard";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";

type Review = { due: boolean; done: number; total: number; next: number; summary: string };
type Phase = "idle" | "drafting" | "preview" | "added" | "error" | "later";

const LATER_KEY = "tangent:round-review-later";

function laterFor(projectId: string, n: number): boolean {
  try {
    return localStorage.getItem(`${LATER_KEY}:${projectId}`) === String(n);
  } catch {
    return false;
  }
}

export default function RoundReview({ projectId, stepsKey, onChanged }: { projectId: string; stepsKey: string; onChanged: () => void }) {
  const reduce = useReducedMotion();
  const [review, setReview] = useState<Review | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<{ changeSet: ChangeSet; preview: PreviewPayload } | null>(null);

  // Re-checked when the project's steps change (one more done can cross 70%).
  useEffect(() => {
    let live = true;
    fetch(`/api/rounds?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Review & { ok?: boolean }) | null) => {
        if (!live || !d?.ok) return;
        setReview(d);
        if (laterFor(projectId, d.next)) setPhase("later");
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId, stepsKey]);

  const advance = useCallback(async () => {
    await fetch("/api/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance", projectId }),
    }).catch(() => undefined);
    setPhase("added");
    onChanged();
  }, [projectId, onChanged]);

  const propose = async () => {
    setPhase("drafting");
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", projectId }),
      });
      const data = (await res.json().catch(() => ({}))) as { action?: string; changeSet?: ChangeSet; preview?: PreviewPayload; ok?: boolean };
      if (data.action === "preview" && data.changeSet && data.preview) {
        setDraft({ changeSet: data.changeSet, preview: data.preview });
        setPhase("preview");
      } else if (res.ok && data.ok !== false) {
        // Previews off: the steps were added straight away (Undo is in the toast).
        await advance();
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  };

  const later = () => {
    try {
      if (review) localStorage.setItem(`${LATER_KEY}:${projectId}`, String(review.next));
    } catch {
      /* it just asks again next visit */
    }
    setPhase("later");
  };

  if (!review?.due || phase === "later") return null;
  const fade = reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };

  return (
    <AnimatePresence initial={false}>
      <m.section className="round-review" aria-labelledby="round-review-title" {...fade}>
        <p className="round-review-eyebrow">Round {review.next - 1} review</p>
        <h2 id="round-review-title">{phase === "added" ? `Round ${review.next} is on your calendar` : "How this round went"}</h2>
        <p className="round-review-summary">{review.summary}</p>
        {phase === "preview" && draft && (
          <PreviewCard
            changeSet={draft.changeSet}
            preview={draft.preview}
            autoFocus
            onChanged={onChanged}
            onConfirmed={() => void advance()}
            onSettled={(p) => {
              if (p !== "confirmed") setPhase("idle");
            }}
          />
        )}
        {(phase === "idle" || phase === "drafting" || phase === "error") && (
          <div className="round-review-actions">
            <Button size="sm" variant="primary" onClick={() => void propose()} disabled={phase === "drafting"}>
              {phase === "drafting" ? "Planning…" : `Plan round ${review.next}`}
            </Button>
            <button type="button" className="round-review-quiet" onClick={later}>Not now</button>
            {phase === "error" && <p className="round-review-error" role="alert">Couldn&apos;t plan that just now. Try again in a moment.</p>}
          </div>
        )}
      </m.section>
    </AnimatePresence>
  );
}
