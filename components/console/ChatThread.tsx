"use client";

// Chronological message list for the AI console. The thread fills the space
// between the header and the composer and scrolls itself so the latest
// exchange is on screen. Older turns fold behind an "N earlier messages"
// divider. When the latest reply is taller than the viewport, it's pinned
// by its top edge and a plain "continues below" notice says so, rather than
// clipping text. Master fix Phase 4: replies render as Markdown, stream in,
// and carry hover actions; the thread follows new text only while the
// student is at the bottom ("Jump to latest" otherwise).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, CalendarPlus, Check, Copy, Pencil, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import PenMark from "@/components/console/PenMark";
import { usePipelineV2 } from "@/components/PipelineFlag";
import ClarifyCard, { type ClarifyAnswer } from "@/components/console/ClarifyCard";
import SuggestionCard from "@/components/console/SuggestionCard";
import Markdown from "@/components/console/Markdown";
import { plainText } from "@/components/console/markdown-parse";
import { redoable, type ChatMode, type PlanProgressView, type Turn } from "@/components/console/turns";
import { formatTime12 } from "@/lib/dates";
import "./chat-ux.css";

/** Turns kept open by default; anything older folds behind the divider. */
const VISIBLE_TURNS = 3;
const LIVE_STEPS: Record<ChatMode, readonly string[]> = {
  plan: ["Reading your request", "Weighing your free time", "Drafting a plan"],
  calendar: ["Reading your request", "Checking your calendar", "Updating your calendar"],
};

/** Scrolled within this of the bottom counts as following the chat. */
const STICK_GAP = 80;

/** Copies the reply as plain text (no Markdown marks). */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(text));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button type="button" className="tg-msg-action" aria-label={copied ? "Copied" : "Copy reply"} title={copied ? "Copied" : "Copy"} onClick={() => void copy()}>
      {copied ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}

type Props = {
  turns: Turn[];
  busy: boolean;
  pendingRequest: string | null;
  onConfirm: (turnId: string, pendingId: string, confirm: boolean) => void;
  onUndone: () => void;
  mode: ChatMode;
  /** Adds a Plan-mode draft to the calendar. */
  onAddPlan: (turnId: string) => void;
  /** A plan being generated for the pending request, shown as it arrives. */
  planProgress?: PlanProgressView | null;
  /** Pipeline V2: the preview card's "Just talking, don't add" chip. */
  onJustChatting?: (turnId: string) => void;
  /** Pipeline V2: a preview card was confirmed (keeps Undo after a reload). */
  onCardConfirmed?: (turnId: string, changeSetId: string, actionId: string) => void;
  /** Pipeline V2: "Keep talking" on the ready-to-add row. */
  onKeepTalking?: (turnId: string) => void;
  /** Answers to a turn's questions; null means "Just do it". */
  onAnswer: (turnId: string, answers: ClarifyAnswer[] | null) => void;
  /** A suggested move was accepted or undone: the calendar changed. */
  onScheduleChanged: () => void;
  /** Answers to questions about a task the turn already saved; null = Later. */
  onAnswerLater: (turnId: string, setId: string, answers: ClarifyAnswer[] | null) => void;
  /** Master fix Phase 4: the pending reply so far, while it streams. */
  streamText?: string;
  /** Resend the last message (last turn only, nothing applied). */
  onRetry?: (turnId: string) => void;
  /** Put the last message back in the composer to edit and resend. */
  onEdit?: (turnId: string) => void;
  onFeedback?: (turnId: string, value: "up" | "down") => void;
};

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ChatThread({ turns, busy, pendingRequest, onConfirm, onUndone, mode, onAddPlan, planProgress, onJustChatting, onCardConfirmed, onKeepTalking, onAnswer, onScheduleChanged, onAnswerLater, streamText = "", onRetry, onEdit, onFeedback }: Props) {
  const v2 = usePipelineV2();
  const planDone = planProgress ? planProgress.tasks.filter(Boolean).length : 0;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  /** null = everything visible; otherwise why content sits below the fold. */
  const [below, setBelow] = useState<null | "reply" | "newer">(null);
  /** Following the bottom of the chat: new text scrolls into view. */
  const stick = useRef(true);
  const wasBusy = useRef(false);

  const hidden = expanded ? 0 : Math.max(0, turns.length - VISIBLE_TURNS);
  const shown = turns.slice(hidden);
  const last = turns[turns.length - 1];

  const measure = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const gap = sc.scrollHeight - sc.scrollTop - sc.clientHeight;
    stick.current = gap <= STICK_GAP;
    if (gap <= 8) return setBelow(null);
    const latest = latestRef.current;
    const readingLatest = latest ? sc.scrollTop + 1 >= latest.offsetTop - 24 : false;
    setBelow(readingLatest ? "reply" : "newer");
  }, []);

  // Bring the newest exchange into view whenever it changes, unless the
  // student has scrolled up to read (Master fix Phase 4: smart scroll).
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    const latest = latestRef.current;
    if (!sc) return;
    if (busy && !wasBusy.current) stick.current = true; // just sent: follow it
    wasBusy.current = busy;
    if (stick.current) {
      if (!busy && !last?.streamed && latest && latest.offsetHeight > sc.clientHeight - 32) {
        // Too tall to fit: start at the question, let the notice point down.
        sc.scrollTop = latest.offsetTop - 16;
      } else {
        sc.scrollTop = sc.scrollHeight;
      }
    }
    measure();
  }, [turns.length, busy, last?.response, last?.pendingConfirm, last?.streamed, planProgress?.title, planDone, streamText, measure]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [measure]);

  const scrollDown = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    stick.current = true;
    sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
  };

  return (
    <div className="tg-thread-wrap">
      <div className="tg-thread" ref={scrollerRef} onScroll={measure} aria-live="polite" aria-busy={busy}>
        <div className="tg-thread-inner">
          {hidden > 0 && (
            <button type="button" className="tg-earlier" onClick={() => setExpanded(true)}>
              <span className="tg-earlier-line" aria-hidden="true" />
              <span className="tg-earlier-label">
                {hidden * 2} earlier message{hidden * 2 === 1 ? "" : "s"} · Show
              </span>
              <span className="tg-earlier-line" aria-hidden="true" />
            </button>
          )}

          {shown.map((t, i) => {
            const isLatest = !busy && i === shown.length - 1;
            const canRedo = isLatest && redoable(t);
            return (
              <article key={t.id} className={`tg-turn${t.fresh ? " is-fresh" : ""}`} ref={isLatest ? latestRef : undefined}>
                <div className="tg-msg-user">{t.request}</div>
                <div className="tg-msg-assistant">
                  <PenMark className="tg-msg-mark" />
                  <div className="tg-msg-body">
                    {(t.tools.length > 0 || t.sourcesChecked.length > 0) && (
                      <div className="tg-msg-meta">
                        {t.tools.map((tool) => (
                          <span key={tool} className="tg-meta-chip">{tool}</span>
                        ))}
                        {t.sourcesChecked.map((source) => (
                          <span key={source} className="tg-meta-chip">Checked {source}</span>
                        ))}
                      </div>
                    )}
                    {/* Master fix B2: a preview's reply is its own summary; the card says it once. */}
                    {!(t.draft && t.response.trim() === t.draft.changeSet.summary.trim()) && (
                      <div className="tg-msg-text">
                        <Markdown text={t.response} reveal={!!t.fresh && !t.streamed} />
                      </div>
                    )}
                    {t.stopped && t.response !== "Stopped." && <p className="tg-msg-stopped">Stopped</p>}
                    {t.pendingConfirm && (
                      <div className="tg-confirm">
                        <button
                          type="button"
                          className="tg-btn tg-btn-accent"
                          onClick={() => onConfirm(t.id, t.pendingConfirm!.id, true)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="tg-btn"
                          onClick={() => onConfirm(t.id, t.pendingConfirm!.id, false)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {t.planDraft && v2 && (
                      <div className="tg-plan-cta">
                        <span>Ready to add this to your calendar?</span>
                        <button type="button" className="tg-btn tg-btn-accent" onClick={() => onAddPlan(t.id)} disabled={busy}>
                          Yes, show preview
                        </button>
                        <button type="button" className="tg-btn" onClick={() => onKeepTalking?.(t.id)} disabled={busy}>
                          Keep talking
                        </button>
                      </div>
                    )}
                    {t.planDraft && !v2 && (
                      <div className="tg-plan-cta">
                        <button type="button" className="tg-btn tg-btn-accent" onClick={() => onAddPlan(t.id)} disabled={busy}>
                          <CalendarPlus size={14} strokeWidth={2} aria-hidden="true" />
                          Add to calendar
                        </button>
                        <span>Switches to Calendar mode and adds this plan.</span>
                      </div>
                    )}
                    {t.draft && (
                      <PreviewCard
                        changeSet={t.draft.changeSet}
                        preview={t.draft.preview}
                        onChanged={onUndone}
                        onConfirmed={onCardConfirmed ? (id) => onCardConfirmed(t.id, t.draft!.changeSet.id, id) : undefined}
                        autoFocus={t.fresh}
                        onJustChatting={onJustChatting ? () => onJustChatting(t.id) : undefined}
                      />
                    )}
                    {t.questions && t.questions.length > 0 && (
                      <ClarifyCard
                        questions={t.questions}
                        disabled={busy}
                        skipLabel={t.pendingQuestion ? "Cancel" : undefined}
                        echo={t.response}
                        onSubmit={(answers) => onAnswer(t.id, answers)}
                      />
                    )}
                    {t.actionId && t.actionLabel && (
                      <ActionReceipt
                        key={`${t.actionId}:${t.undoStatus ?? ""}`}
                        actionId={t.actionId}
                        label={t.actionLabel}
                        onUndone={onUndone}
                        initiallyUndone={t.undoStatus === "undone"}
                        expired={t.undoStatus === "expired"}
                      />
                    )}
                    {t.projectId && (
                      <a className="tg-project-link" href={`/projects/${t.projectId}`}>
                        Open the project →
                      </a>
                    )}
                    {t.suggestion && <SuggestionCard suggestion={t.suggestion} onMoved={onScheduleChanged} />}
                    {t.later && t.later.questions.length > 0 && (
                      <ClarifyCard
                        questions={t.later.questions}
                        disabled={busy}
                        skipLabel="Later"
                        onSubmit={(answers) => onAnswerLater(t.id, t.later!.id, answers)}
                      />
                    )}
                    {t.laterSummary && <p className="tg-later-summary">{t.laterSummary}</p>}
                    {t.response.trim() && (
                      <div className="tg-msg-actions" role="toolbar" aria-label="Reply actions">
                        <CopyButton text={t.response} />
                        {canRedo && onRetry && (
                          <button type="button" className="tg-msg-action" aria-label="Retry" title="Retry" onClick={() => onRetry(t.id)}>
                            <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                        {canRedo && onEdit && (
                          <button type="button" className="tg-msg-action" aria-label="Edit your message" title="Edit your message" onClick={() => onEdit(t.id)}>
                            <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                        {onFeedback && (
                          <>
                            <button
                              type="button"
                              className="tg-msg-action"
                              aria-label="Good reply"
                              title="Good reply"
                              aria-pressed={t.feedback === "up"}
                              onClick={() => onFeedback(t.id, "up")}
                            >
                              <ThumbsUp size={14} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="tg-msg-action"
                              aria-label="Bad reply"
                              title="Bad reply"
                              aria-pressed={t.feedback === "down"}
                              onClick={() => onFeedback(t.id, "down")}
                            >
                              <ThumbsDown size={14} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {busy && (
            <article className="tg-turn is-pending is-fresh" ref={latestRef}>
              <div className="tg-msg-user">{pendingRequest}</div>
              <div className="tg-msg-assistant">
                <PenMark className="tg-msg-mark is-working" />
                {streamText ? (
                  <div className="tg-msg-body">
                    <div className="tg-msg-text is-streaming">
                      <Markdown text={streamText} />
                    </div>
                  </div>
                ) : planProgress?.title ? (
                  <div className="tg-plan-live">
                    <p className="tg-plan-live-head">
                      <span className="tg-plan-live-status">Building your plan…</span>
                      <strong>{planProgress.title}</strong>
                      <span className="tg-plan-live-count">
                        {planDone} of {planProgress.taskCount} sessions
                      </span>
                    </p>
                    <ol className="tg-plan-live-list">
                      {planProgress.tasks.map((task, i) =>
                        task ? (
                          <li key={i}>
                            <span className="tg-plan-live-when">
                              {shortDate(task.date)} · {formatTime12(task.time)}
                            </span>
                            <span>{task.title}</span>
                          </li>
                        ) : null
                      )}
                    </ol>
                  </div>
                ) : mode === "plan" ? (
                  <span className="tg-typing" role="status" aria-label="Tangent is typing">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <ol className="tg-steps">
                    {LIVE_STEPS[mode].map((step, i) => (
                      <li key={step} style={{ animationDelay: `${i * 0.35}s` }}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          )}
        </div>
      </div>

      {below && (
        <button type="button" className="tg-below" onClick={scrollDown}>
          <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
          {below === "reply" ? "This reply continues below" : "Jump to latest"}
        </button>
      )}
    </div>
  );
}
