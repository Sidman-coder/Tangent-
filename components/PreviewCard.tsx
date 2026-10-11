"use client";

// Pipeline V2 preview card: what the AI proposes, before anything is saved.
// Confirm writes it (POST /api/changesets/[id]/confirm), Discard drops it,
// Edit removes a change or moves a task. After Confirm it collapses to
// "Added to your calendar · Undo". Only rendered when /api/chat answers with
// action "preview", which happens only while TANGENT_PIPELINE_V2 is on.
//
// Keys while the card has focus: Enter confirms, Esc discards.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import { useAppState } from "@/components/AppStateProvider";

type Phase = "draft" | "confirmed" | "discarded" | "undone";

type Props = {
  changeSet: ChangeSet;
  preview: PreviewPayload;
  /** The calendar changed (confirm or undo): reload app state. */
  onChanged?: () => void;
  /** Confirmed: the undo entry's id, so the chat can keep Undo after a reload. */
  onConfirmed?: (actionId: string) => void;
  /** Focus the card when it appears so Enter/Esc work straight away. */
  autoFocus?: boolean;
  className?: string;
  /** Called when the card leaves the draft state (confirmed, discarded, undone). */
  onSettled?: (phase: Exclude<Phase, "draft">) => void;
  /** Shows a "Just talking, don't add" chip: discards the draft (reason
   *  just_chatting), then the caller answers conversationally. */
  onJustChatting?: () => void;
};

async function post(url: string, body?: unknown, method = "POST"): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

const phaseOf = (status: unknown): Phase | null =>
  status === "confirmed" || status === "discarded" || status === "undone" || status === "draft" ? status : null;

export default function PreviewCard({ changeSet, preview, onChanged, onConfirmed, autoFocus = false, className, onSettled, onJustChatting }: Props) {
  const { state } = useAppState();
  const [cs, setCs] = useState(changeSet);
  const [view, setView] = useState(preview);
  const [phase, setPhase] = useState<Phase>(phaseOf(changeSet.status) ?? "draft");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const [chatting, setChatting] = useState(false);
  const [expired, setExpired] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const base = `/api/changesets/${encodeURIComponent(cs.id)}`;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (phase !== "draft") settledRef.current?.(phase);
  }, [phase]);

  // preview_shown, once per card.
  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    void fetch(`${base}/shown`, { method: "POST" }).catch(() => {});
    if (autoFocus) cardRef.current?.focus();
  }, [base, autoFocus]);

  const act = useCallback(
    async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  /** A refused action (409) means another tab or click already moved it on. */
  const settle = (status: number, data: Record<string, unknown>) => {
    const p = phaseOf(data.status);
    if (data.reason === "expired") setExpired(true);
    if (status === 409 && p && p !== "draft") setPhase(p);
    throw new Error(typeof data.message === "string" ? data.message : "Something went wrong.");
  };

  const confirm = () =>
    act(async () => {
      const { status, data } = await post(`${base}/confirm`);
      if (!data.ok) return settle(status, data);
      const skipped = (data.skipped_duplicates as { titles?: string[] } | undefined)?.titles ?? [];
      const created = typeof data.createdTaskCount === "number" ? data.createdTaskCount : -1;
      setResult({ created, skipped });
      setPhase("confirmed");
      setEditing(false);
      onChanged?.();
      if (typeof data.actionId === "string") onConfirmed?.(data.actionId);
    });

  const discard = () =>
    act(async () => {
      const { status, data } = await post(`${base}/discard`);
      if (!data.ok) return settle(status, data);
      setPhase("discarded");
      setEditing(false);
    });

  const justChatting = () =>
    act(async () => {
      const { status, data } = await post(`${base}/discard`, { reason: "just_chatting" });
      if (!data.ok) return settle(status, data);
      setChatting(true);
      setPhase("discarded");
      setEditing(false);
      onJustChatting?.();
    });

  const undo = () =>
    act(async () => {
      const { status, data } = await post(`${base}/undo`);
      if (!data.ok) return settle(status, data);
      setPhase("undone");
      onChanged?.();
    });

  const edit = (body: { type: "remove"; index: number } | { type: "date"; index: number; date: string } | { type: "time"; index: number; time: string }) =>
    act(async () => {
      const { status, data } = await post(base, body, "PATCH");
      if (!data.ok) return settle(status, data);
      setCs(data.changeSet as ChangeSet);
      setView(data.preview as PreviewPayload);
    });

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (phase !== "draft" || busy) return;
    const t = e.target as HTMLElement;
    // Buttons and edit fields keep their own Enter/Esc.
    if (t !== e.currentTarget && (t.tagName === "INPUT" || t.tagName === "BUTTON")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void confirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      void discard();
    }
  };

  const cls = `preview-card${className ? ` ${className}` : ""}`;

  if (phase === "confirmed" || phase === "undone") {
    const nothing = result?.created === 0;
    return (
      <div className={`${cls} is-done`} role="status">
        <div className="action-receipt">
          <span className="action-receipt-label">
            {phase === "undone" ? "Removed from your calendar" : nothing ? "Already on your calendar · nothing new added" : "Added to your calendar"}
          </span>
          {phase === "confirmed" && !nothing ? (
            <button type="button" className="action-receipt-undo" onClick={() => void undo()} disabled={busy}>
              {busy ? "Undoing…" : "Undo"}
            </button>
          ) : phase === "undone" ? (
            <span className="action-receipt-status">Undone</span>
          ) : null}
        </div>
        {phase === "confirmed" && result && result.skipped.length > 0 && !nothing && (
          <p className="preview-card-note">Skipped, already on your calendar: {result.skipped.join(", ")}</p>
        )}
        {error && <p className="preview-card-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (phase === "discarded") {
    return (
      <div className={`${cls} is-done`} role="status">
        <span className="preview-card-muted">{chatting ? "Not added. Just talking." : expired ? "This draft expired. Ask again for a fresh preview." : "Discarded. Nothing was added."}</span>
      </div>
    );
  }

  const newPlan = cs.ops.find((o) => o.op === "create_plan");
  const target = cs.target_plan_id ? state?.plans?.find((p) => p.id === cs.target_plan_id) : undefined;

  return (
    <div
      className={cls}
      ref={cardRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="group"
      aria-label={`Proposed change: ${cs.summary}. Enter to confirm, Escape to discard.`}
    >
      <p className="preview-card-kicker">
        {newPlan ? `New plan: ${newPlan.title}` : target ? `Updating ${target.title}` : "Preview · not added yet"}
      </p>
      <p className="preview-card-title">{cs.summary}</p>

      <ul className="preview-card-lines">
        {view.lines.map((line, i) => {
          const op = cs.ops[i];
          const movable = op && (op.op === "add_task" || op.op === "move_task");
          return (
            <li key={`${i}-${line}`}>
              <span className="preview-card-line">{line}</span>
              {editing && (
                <span className="preview-card-edit">
                  {movable && (
                    <>
                      <input
                        type="date"
                        aria-label="Date"
                        defaultValue={op.date}
                        disabled={busy}
                        onChange={(e) => e.target.value && void edit({ type: "date", index: i, date: e.target.value })}
                      />
                      <input
                        type="time"
                        aria-label="Time"
                        defaultValue={op.time ?? ""}
                        disabled={busy}
                        onBlur={(e) => e.target.value !== (op.time ?? "") && void edit({ type: "time", index: i, time: e.target.value })}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    className="preview-card-remove"
                    aria-label={`Remove: ${line}`}
                    disabled={busy}
                    onClick={() => void edit({ type: "remove", index: i })}
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {cs.assumptions.length > 0 && (
        <ul className="preview-card-assumptions">
          {cs.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {view.likelyDuplicates.length > 0 && (
        <p className="preview-card-note">Probably already on your calendar, will be skipped: {view.likelyDuplicates.join(", ")}</p>
      )}
      {error && <p className="preview-card-error" role="alert">{error}</p>}

      <div className="preview-card-actions">
        <button type="button" className="preview-card-btn is-primary" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Working…" : "Confirm"}
        </button>
        <button type="button" className="preview-card-btn" onClick={() => setEditing((v) => !v)} disabled={busy} aria-pressed={editing}>
          {editing ? "Done editing" : "Edit"}
        </button>
        <button type="button" className="preview-card-btn" onClick={() => void discard()} disabled={busy}>
          Discard
        </button>
        {onJustChatting && (
          <button type="button" className="preview-card-btn is-chip" onClick={() => void justChatting()} disabled={busy}>
            Just talking, don&apos;t add
          </button>
        )}
        <span className="preview-card-keys" aria-hidden="true">Enter to confirm · Esc to discard</span>
      </div>
    </div>
  );
}
