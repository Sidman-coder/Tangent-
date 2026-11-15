"use client";

// Round 5A 2.3: Home's plan brief, beside the calendar once round 1 is placed.
// Top to bottom: the goal line; "Round 1: what you'll get this week"; a card
// per step (what, when, why, what you'll have); "What I used about you"; what
// it assumed; what happens next; Confirm / Edit / Discard; then the composer.
// The actions are the same calls as PreviewCard (usePreviewActions).

import { useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { usePreviewActions } from "@/components/preview/usePreviewActions";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import { stepCards, whenLabel } from "@/lib/plan-steps-view";
import type { BriefView } from "@/lib/voice-handler";

export default function PlanBrief({
  changeSet,
  preview,
  brief,
  goal,
  onChanged,
  onConfirmed,
  onSettled,
  onOps,
  composer,
}: {
  changeSet: ChangeSet;
  preview: PreviewPayload;
  brief: BriefView | null;
  goal: string;
  onChanged?: () => void;
  onConfirmed?: (count: number) => void;
  /** Confirmed, discarded or undone: the caller closes the workspace. */
  onSettled?: (phase: "confirmed" | "discarded" | "undone") => void;
  onOps?: (ops: ChangeSet["ops"]) => void;
  composer: ReactNode;
}) {
  const { cs, view, phase, busy, error, result, expired, confirm, discard, undo, edit } = usePreviewActions({
    changeSet,
    preview,
    onChanged,
    onOps,
    onConfirmed: () => onConfirmed?.(stepCards(cs.ops).length),
  });
  const [editing, setEditing] = useState(false);
  const cards = stepCards(cs.ops, brief?.steps);
  const newPlan = cs.ops.find((o) => o.op === "create_plan");
  const goalLine = brief?.goalLine || (newPlan && "title" in newPlan ? newPlan.title : "") || goal;
  const used = brief?.used.length ? brief.used : view.factsUsed ?? [];

  useEffect(() => {
    if (phase !== "draft") {
      setEditing(false);
      onSettled?.(phase);
    }
    // onSettled is the caller's; only the phase change matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <article className="plan-brief" aria-labelledby="plan-brief-goal">
      <h2 id="plan-brief-goal" className="plan-brief-goal">{goalLine}</h2>

      <section aria-labelledby="plan-brief-round">
        <h3 id="plan-brief-round" className="plan-brief-h">Round 1: what you&apos;ll get this week</h3>
        <ol className="plan-brief-steps">
          {cards.map((c) => (
            <li key={`${c.index}-${c.title}`} className="plan-step-card">
              <div className="plan-step-head">
                <p className="plan-step-what">{c.title}</p>
                {editing && (
                  <button type="button" className="plan-step-remove" aria-label={`Remove: ${c.title}`} disabled={busy} onClick={() => void edit({ type: "remove", index: c.index })}>
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
              {editing ? (
                <div className="plan-step-edit">
                  <input name="step-date" type="date" aria-label={`Day for ${c.title}`} defaultValue={c.date} disabled={busy} onChange={(e) => e.target.value && void edit({ type: "date", index: c.index, date: e.target.value })} />
                  <input name="step-time" type="time" aria-label={`Time for ${c.title}`} defaultValue={c.time} disabled={busy} onBlur={(e) => e.target.value !== c.time && void edit({ type: "time", index: c.index, time: e.target.value })} />
                </div>
              ) : (
                <p className="plan-step-when">{whenLabel(c.date, c.time)}</p>
              )}
              {c.why && (
                <p className="plan-step-detail">
                  <span>Why</span> {c.why}
                </p>
              )}
              {c.youllHave && (
                <p className="plan-step-detail">
                  <span>You&apos;ll have</span> {c.youllHave}
                </p>
              )}
            </li>
          ))}
        </ol>
        {brief?.dropNote && <p className="plan-brief-note">{brief.dropNote}</p>}
      </section>

      {used.length > 0 && (
        <section aria-labelledby="plan-brief-used">
          <h3 id="plan-brief-used" className="plan-brief-h">What I used about you</h3>
          <ul className="plan-brief-list">
            {used.slice(0, 6).map((u) => <li key={u}>{u}</li>)}
          </ul>
        </section>
      )}

      {cs.assumptions.length > 0 && (
        <section aria-labelledby="plan-brief-assumed">
          <h3 id="plan-brief-assumed" className="plan-brief-h">What I assumed</h3>
          <ul className="plan-brief-list">
            {cs.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="plan-brief-next">
        <h3 id="plan-brief-next" className="plan-brief-h">What happens next</h3>
        <p className="plan-brief-text">Nothing is on your calendar until you confirm. When you finish these, tell me how they went and I&apos;ll plan round 2.</p>
      </section>

      {view.likelyDuplicates.length > 0 && <p className="plan-brief-note">Probably already on your calendar, will be skipped: {view.likelyDuplicates.join(", ")}</p>}
      {error && <p className="plan-brief-error" role="alert">{error}</p>}

      {phase === "draft" ? (
        <div className="plan-brief-actions">
          <Button variant="primary" onClick={() => void confirm()} loading={busy} loadingLabel="Adding to your calendar">
            Confirm
          </Button>
          <Button variant="secondary" onClick={() => setEditing((v) => !v)} disabled={busy} aria-pressed={editing}>
            {editing ? "Done editing" : "Edit"}
          </Button>
          <Button variant="ghost" onClick={() => void discard()} disabled={busy}>
            Discard
          </Button>
        </div>
      ) : (
        <div className="plan-brief-done" role="status">
          {phase === "confirmed" ? (
            <>
              <Check size={16} strokeWidth={2} aria-hidden="true" />
              <span>
                {result && result.created >= 0 ? `Added ${result.created} step${result.created === 1 ? "" : "s"} to your calendar.` : "Added to your calendar."}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={busy}>
                Undo
              </Button>
            </>
          ) : (
            <span>{phase === "undone" ? "Undone. Nothing was added." : expired ? "This draft expired. Ask again for a fresh one." : "Discarded. Nothing was added."}</span>
          )}
        </div>
      )}

      <div className="plan-brief-composer">{composer}</div>
    </article>
  );
}
