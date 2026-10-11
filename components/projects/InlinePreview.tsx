"use client";

// Pipeline V2 (A6): a drafted change inside a project, where the full preview
// card doesn't fit (the project chat and the Projects Ask box). It lists what
// would change, then Confirm or Discard; nothing is saved before Confirm, and
// the result keeps Undo (ActionReceipt). Uses the same ChangeSet endpoints as
// components/PreviewCard.tsx.

import { useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";

const SHOWN_LINES = 8;

type Props = {
  changeSet: ChangeSet;
  preview: PreviewPayload;
  /** After Confirm: the receipt's action and, for a new project, its plan. */
  onConfirmed?: (r: { actionId?: string; planId?: string }) => void;
  onChanged?: () => void;
};

export default function InlinePreview({ changeSet, preview, onConfirmed, onChanged }: Props) {
  const [phase, setPhase] = useState<"draft" | "confirmed" | "discarded">("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const base = `/api/changesets/${encodeURIComponent(changeSet.id)}`;

  const post = async (path: "confirm" | "discard") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${path}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; actionId?: string; planId?: string | null };
      if (!data.ok) throw new Error(data.message || "Something went wrong.");
      if (path === "discard") return setPhase("discarded");
      setPhase("confirmed");
      setActionId(data.actionId ?? null);
      onChanged?.();
      onConfirmed?.({ actionId: data.actionId, planId: data.planId ?? undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "discarded") return <p className="inline-preview-note">Discarded. Nothing changed.</p>;
  if (phase === "confirmed") {
    return actionId ? (
      <ActionReceipt actionId={actionId} label={`Done: ${changeSet.summary}`} onUndone={onChanged} />
    ) : (
      <p className="inline-preview-note">Done.</p>
    );
  }

  const extra = preview.lines.length - SHOWN_LINES;
  return (
    <div className="inline-preview" role="group" aria-label={changeSet.summary}>
      <p className="inline-preview-head">{changeSet.summary}</p>
      <ul className="inline-preview-lines">
        {preview.lines.slice(0, SHOWN_LINES).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        {extra > 0 && <li className="inline-preview-more">and {extra} more</li>}
      </ul>
      {preview.likelyDuplicates.length > 0 && (
        <p className="inline-preview-note">Already on your calendar, so skipped: {preview.likelyDuplicates.join(", ")}</p>
      )}
      <div className="inline-preview-actions">
        <button type="button" className="inline-preview-btn is-primary" onClick={() => void post("confirm")} disabled={busy}>
          Confirm
        </button>
        <button type="button" className="inline-preview-btn" onClick={() => void post("discard")} disabled={busy}>
          Discard
        </button>
      </div>
      {error && <p className="project-ask-error" role="alert">{error}</p>}
    </div>
  );
}
