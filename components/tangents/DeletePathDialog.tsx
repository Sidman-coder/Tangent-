"use client";

import { useEffect, useRef } from "react";
import { m } from "motion/react";
import { TriangleAlert } from "lucide-react";
import type { Path } from "@/lib/types";

// Deleting a path takes its whole tree with it, and there is no undo for it:
// the console's action log is a different mechanism, and path edits are not
// recorded into it. So the guard is this — a dialog that says out loud what is
// about to go, counted from what is actually on the path rather than a vague
// "are you sure".

type Props = {
  path: Path;
  /** What is on the circle, and how many branches hang off it. */
  counts: { work: number; ideas: number };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function loss({ work, ideas }: { work: number; ideas: number }): string | null {
  const parts: string[] = [];
  if (work > 0) parts.push(`${work} thing${work === 1 ? "" : "s"} on the circle`);
  if (ideas > 0) parts.push(`${ideas} branch${ideas === 1 ? "" : "es"}`);
  if (parts.length === 0) return null;
  return parts.join(" and ");
}

export default function DeletePathDialog({ path, counts, busy, onCancel, onConfirm }: Props) {
  // Focus lands on Cancel, not Delete: the safe half of a destructive choice
  // should be the one a stray Return key hits.
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const going = loss(counts);

  return (
    <div
      className="tangents-intake-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-path-title"
      // A click on the dark outside the card is a cancel, like the intake sheet.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <m.div
        className="tangents-confirm"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", visualDuration: 0.36, bounce: 0.14 }}
      >
        <span className="tangents-confirm-mark" aria-hidden="true">
          <TriangleAlert size={18} />
        </span>

        <h2 id="delete-path-title">Delete this path?</h2>
        <p>
          <strong>{path.title}</strong>
          {going ? ` goes, and so do the ${going} on it.` : " goes."} This can&apos;t be undone.
        </p>

        <footer className="tangents-confirm-foot">
          <button type="button" className="path-btn is-quiet" ref={cancelRef} onClick={onCancel} disabled={busy}>
            Keep it
          </button>
          <button type="button" className="path-btn is-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting" : "Delete path"}
          </button>
        </footer>
      </m.div>
    </div>
  );
}
