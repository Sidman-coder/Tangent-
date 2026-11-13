"use client";

// Pipeline V2 preview card: what the AI proposes, before anything is saved.
// Confirm writes it (POST /api/changesets/[id]/confirm), Discard drops it,
// Edit removes a change or moves a task. After Confirm it collapses to
// "Added to your calendar · Undo". Only rendered when /api/chat answers with
// action "preview", which happens only while TANGENT_PIPELINE_V2 is on.
//
// Keys while the card has focus: Enter confirms, Esc discards.

import Link from "next/link";
import { commitmentLabel } from "@/lib/task-kind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { DraftEdit, PreviewPayload } from "@/lib/pipeline/draft";
import { receiptView } from "@/lib/pipeline/receipt";
import PlanCalendarPreview from "@/components/preview/PlanCalendarPreview";
import { getUserToday } from "@/lib/time";
import HelpPlanBetter from "@/components/grill/HelpPlanBetter";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";

type Phase = "draft" | "confirmed" | "discarded" | "undone";

type Props = {
  changeSet: ChangeSet;
  preview: PreviewPayload;
  /** The calendar changed (confirm or undo): reload app state. */
  onChanged?: () => void;
  /** Confirmed: the undo entry's id, so the chat can keep Undo after a reload. */
  onConfirmed?: (actionId: string, info?: { planId: string | null }) => void;
  /** Focus the card when it appears so Enter/Esc work straight away. */
  autoFocus?: boolean;
  className?: string;
  /** Called when the card leaves the draft state (confirmed, discarded, undone). */
  onSettled?: (phase: Exclude<Phase, "draft">) => void;
  /** Shows a "Just talking, don't add" chip: discards the draft (reason
   *  just_chatting), then the caller answers conversationally. */
  onJustChatting?: () => void;
  /** What the student said and how many questions they already answered, so
   *  "Help Tangent plan better" doesn't ask them again. */
  grill?: { said: string; asked: number };
  /** Round 4 §3.3: the planning workspace shows the calendar in its own pane. */
  hideCalendar?: boolean;
  /** Called with the draft's ops whenever they change (an edit removes or moves one). */
  onOps?: (ops: ChangeSet["ops"]) => void;
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

export default function PreviewCard({ changeSet, preview, onChanged, onConfirmed, autoFocus = false, className, onSettled, onJustChatting, grill, hideCalendar = false, onOps }: Props) {
  const { state } = useAppState();
  const timezone = useUserTimezone();
  const [cs, setCs] = useState(changeSet);
  const [view, setView] = useState(preview);
  const [phase, setPhase] = useState<Phase>(phaseOf(changeSet.status) ?? "draft");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: string[]; planId: string | null } | null>(null);
  /** Master fix Phase 4: "See all N sessions", grouped by week. */
  const [allOpen, setAllOpen] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [expired, setExpired] = useState(false);
  const hasCalendar = useMemo(() => cs.ops.some((op) => op.op === "add_task" || op.op === "move_task"), [cs.ops]);
  const cardRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const base = `/api/changesets/${encodeURIComponent(cs.id)}`;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  const opsRef = useRef(onOps);
  opsRef.current = onOps;
  useEffect(() => opsRef.current?.(cs.ops), [cs.ops]);

  // A confirmed plan stays put until its "Help Tangent plan better" is through.
  const [grillDone, setGrillDone] = useState(false);
  const grillPlan = result && result.created !== 0 ? result.planId ?? cs.target_plan_id ?? null : null;
  const grillWaiting = phase === "confirmed" && Boolean(grillPlan) && !grillDone;

  useEffect(() => {
    if (phase !== "draft" && !grillWaiting) settledRef.current?.(phase);
  }, [phase, grillWaiting]);

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
      const planId = typeof data.planId === "string" ? data.planId : null;
      setResult({ created, skipped, planId });
      setPhase("confirmed");
      setEditing(false);
      onChanged?.();
      if (typeof data.actionId === "string") onConfirmed?.(data.actionId, { planId });
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

  const edit = (body: DraftEdit) =>
    act(async () => {
      const { status, data } = await post(base, body, "PATCH");
      if (!data.ok) return settle(status, data);
      setCs(data.changeSet as ChangeSet);
      setView((prev) => ({ ...(data.preview as PreviewPayload), factsUsed: (data.preview as PreviewPayload).factsUsed ?? prev.factsUsed }));
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
    // Master fix Phase 4: a headline, a few of the changes, the rest by week,
    // then one quiet row: Undo · Open project · Details.
    const summary = receiptView(cs, view.lines, result && result.created >= 0 ? result.created : undefined);
    const planTitle = cs.ops.flatMap((o) => (o.op === "create_plan" ? [o.title] : []))[0];
    const projectId =
      result?.planId ?? cs.target_plan_id ?? (planTitle ? state?.plans?.find((p) => p.title === planTitle)?.id : undefined) ?? null;
    const lineList = (lines: string[]) => (
      <ul className="preview-card-receipt-lines">
        {lines.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    );
    return (
      <div className={`${cls} is-done`} role="status">
        <p className="preview-card-receipt-head">
          {phase === "undone" ? "Removed from your calendar" : nothing ? "Already on your calendar · nothing new added" : summary.headline}
        </p>
        {phase === "confirmed" && !nothing && (
          <>
            {allOpen
              ? summary.weeks.map((w) => (
                  <div key={w.label} className="preview-card-receipt-week">
                    <p className="preview-card-receipt-week-label">{w.label}</p>
                    {lineList(w.lines)}
                  </div>
                ))
              : summary.lines.length > 0 && lineList(summary.lines)}
            {summary.total > summary.lines.length && (
              <button type="button" className="preview-card-receipt-more" aria-expanded={allOpen} onClick={() => setAllOpen((v) => !v)}>
                {allOpen ? "Show less" : `See all ${summary.total} ${planTitle ? "sessions" : "changes"}`}
              </button>
            )}
          </>
        )}
        <div className="action-receipt is-quiet">
          {phase === "confirmed" && !nothing ? (
            <button type="button" className="action-receipt-undo" onClick={() => void undo()} disabled={busy}>
              {busy ? "Undoing…" : "Undo"}
            </button>
          ) : phase === "undone" ? (
            <span className="action-receipt-status">Undone</span>
          ) : null}
          {phase === "confirmed" && !nothing && projectId && (
            <Link className="action-receipt-details" href={`/projects/${projectId}`}>
              Open project
            </Link>
          )}
          <Link className="action-receipt-details" href={`/settings/activity?activity=${encodeURIComponent(`cs:${cs.id}`)}`}>
            Details
          </Link>
        </div>
        {phase === "confirmed" && result && result.skipped.length > 0 && !nothing && (
          <p className="preview-card-note">Skipped, already on your calendar: {result.skipped.join(", ")}</p>
        )}
        {error && <p className="preview-card-error" role="alert">{error}</p>}
        {phase === "confirmed" && grillPlan && !grillDone && (
          <HelpPlanBetter planId={grillPlan} said={grill?.said ?? cs.summary} asked={grill?.asked ?? 0} onDone={() => setGrillDone(true)} />
        )}
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

      {hasCalendar && !editing && !hideCalendar && <PlanCalendarPreview ops={cs.ops} tasks={state?.tasks ?? []} plans={state?.plans ?? []} weekStart={state?.user.weekStart ?? 0} today={getUserToday(timezone)} />}

      <ul className="preview-card-lines" hidden={hasCalendar && !editing && !hideCalendar && cs.ops.every((op) => op.op === "add_task" || op.op === "move_task" || op.op === "create_plan")}>
        {view.lines.map((line, i) => {
          const op = cs.ops[i];
          // A plan removal shows as its checkbox below, not as a line.
          if (op?.op === "delete_plan" || (hasCalendar && !editing && (op?.op === "add_task" || op?.op === "move_task" || op?.op === "create_plan"))) return null;
          const movable = op && (op.op === "add_task" || op.op === "move_task");
          return (
            <li key={`${i}-${line}`}>
              <span className="preview-card-line">{line}</span>
                {op?.op === "add_task" && op.commitment && <span className="preview-card-kind">{commitmentLabel(op.commitment)}</span>}
              {editing && (
                <span className="preview-card-edit">
                  {movable && (
                    <>
                      <input
                        name="move-date"
                        type="date"
                        aria-label="Date"
                        defaultValue={op.date}
                        disabled={busy}
                        onChange={(e) => e.target.value && void edit({ type: "date", index: i, date: e.target.value })}
                      />
                      <input
                        name="move-time"
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

      {/* Master fix B6: several selected plans read as one group. */}
      {view.planRemovals && view.planRemovals.length > 1 && <p className="preview-card-muted">Also remove these plans</p>}
      {view.planRemovals?.map((r) => (
        <label key={r.planId} className="preview-card-check">
          <input
            name="keep-removal"
            type="checkbox"
            checked={r.checked}
            disabled={busy}
            onChange={(e) => void edit({ type: "plan_removal", plan_id: r.planId, remove: e.target.checked })}
          />
          {view.planRemovals!.length > 1 ? <>&ldquo;{r.title}&rdquo;</> : <>Also remove the plan &ldquo;{r.title}&rdquo;</>}
        </label>
      ))}

      {cs.assumptions.length > 0 && (
        <ul className="preview-card-assumptions">
          {cs.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {view.factsUsed && view.factsUsed.length > 0 && (
        <p className="preview-card-used">
          <span>Used:</span> {view.factsUsed.join(" · ")}
        </p>
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
