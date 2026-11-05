"use client";

// One task, opened in the middle of the screen — like an event in Google
// Calendar. Every place a task is clicked (calendar month/week/agenda,
// Today, projects) opens this through openTask(); the day panel is only for
// clicking a date.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, MessageSquareText, Trash2, X } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import { openTaskChat } from "@/components/chat/TaskChatSheet";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { splitCourse } from "@/lib/course";
import { generateQuestions } from "@/lib/questions-client";
import { categoryLabel, seriesColor, taskSeries } from "@/lib/task-colors";
import { COMMITMENT_OPTIONS, commitmentOf } from "@/lib/task-kind";
import { formatTaskDay, formatTaskWhen, taskEndTime } from "@/lib/task-when";
import type { Task, TaskCommitment } from "@/lib/types";
import "./task-detail.css";

export const OPEN_TASK_EVENT = "tangent:open-task";

/** Open a task in the centred card. */
export function openTask(taskId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId } }));
}

/** Tangent's notes come as "GOAL: … FOCUS: … TIME: …"; show them as parts. */
function noteParts(notes: string): { label: string; text: string }[] | null {
  const LABELS: Record<string, string> = { GOAL: "Goal", FOCUS: "What to do", TIME: "Time" };
  const re = /(GOAL|FOCUS|TIME):\s*/g;
  const hits = Array.from(notes.matchAll(re));
  if (hits.length < 2) return null;
  return hits
    .map((h, i) => ({
      label: LABELS[h[1]],
      text: notes.slice((h.index ?? 0) + h[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim(),
    }))
    .filter((p) => p.text);
}

/** Tasks already given steps this session, so a card never asks twice. */
const planned = new Set<string>();


export default function TaskDetail() {
  const { state, refresh } = useAppState();
  const timezone = useUserTimezone();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreNotes, setMoreNotes] = useState(false);
  const [removed, setRemoved] = useState<{ actionId: string; title: string } | null>(null);
  const [typeChange, setTypeChange] = useState<{ actionId: string } | { note: string } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const task = taskId ? state?.tasks.find((t) => t.id === taskId) ?? null : null;
  const [planning, setPlanning] = useState(false);

  // A task added with just a title ("Research GRITS FRC") gets a goal, what
  // to do, a time estimate and a first step the first time it's opened,
  // through the same tidy step quick adds use (/api/questions, enrich).
  const needsPlan = Boolean(
    task && !task.completed && !task.notes?.trim() && !task.startAction?.trim() && task.source !== "canvas" && task.kind !== "school" && !task.recurring?.enabled
  );
  useEffect(() => {
    if (!task || !needsPlan || planned.has(task.id)) return;
    planned.add(task.id);
    setPlanning(true);
    void generateQuestions(task.id, task.title, true)
      .then(() => refresh())
      .finally(() => setPlanning(false));
  }, [task, needsPlan, refresh]);
  const plan = task?.planId ? state?.plans.find((p) => p.id === task.planId) ?? null : null;

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
      if (!id) return;
      setRemoved(null);
      setTypeChange(null);
      setMoreNotes(false);
      setTaskId(id);
    };
    window.addEventListener(OPEN_TASK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TASK_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    setTaskId(null);
    setRemoved(null);
  }, []);

  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => cardRef.current?.focus(), 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, close]);

  const post = async (body: unknown) => {
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({}))) as { ok?: boolean; saved?: boolean; actionId?: string };
  };

  const toggle = async () => {
    if (!task) return;
    setBusy(true);
    await post({ action: "update_task", id: task.id, completed: !task.completed });
    await refresh();
    setBusy(false);
  };

  const changeType = async (commitment: TaskCommitment) => {
    if (!task) return;
    setBusy(true);
    const data = await post({ action: "set_commitment", id: task.id, commitment });
    setBusy(false);
    if (data.saved && data.actionId) setTypeChange({ actionId: data.actionId });
    else setTypeChange({ note: data.ok ? "This can't be saved yet." : "Couldn't change the type. Try again." });
    void refresh();
  };

  const remove = async () => {
    if (!task) return;
    setBusy(true);
    const data = await post({ action: "delete_task", id: task.id });
    setBusy(false);
    if (data.actionId) setRemoved({ actionId: data.actionId, title: task.title });
    else close();
    void refresh();
  };

  if (typeof document === "undefined") return null;
  const open = Boolean(taskId && (task || removed));
  const { title, course } = task ? splitCourse(task) : { title: removed?.title ?? "", course: null };
  const due = task ? task.source === "canvas" || task.time === "23:59" : false;
  const color = task ? seriesColor(taskSeries(task, state?.plans ?? [])) : "var(--accent)";

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <m.div
            key="scrim"
            className="td-scrim"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
          >
            <m.div
              ref={cardRef}
              className="td-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="td-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", visualDuration: 0.28, bounce: 0 } }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            >
              <div className="td-toolbar">
                {task && (
                  <>
                    <button type="button" className="td-icon lg lg-interactive" onClick={() => {
                        // One window at a time: the card steps aside for the chat.
                        setTaskId(null);
                        openTaskChat(task.id);
                      }} aria-label="Ask about this" title="Ask about this">
                      <MessageSquareText size={17} aria-hidden="true" />
                    </button>
                    <button type="button" className="td-icon lg lg-interactive" onClick={() => void remove()} disabled={busy} aria-label="Remove task" title="Remove">
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </>
                )}
                <button type="button" className="td-icon lg lg-interactive" onClick={close} aria-label="Close" title="Close">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {removed && !task ? (
                <div className="td-body">
                  <ActionReceipt
                    actionId={removed.actionId}
                    label={`Removed “${splitCourse({ title: removed.title, source: undefined }).title}”`}
                    onUndone={() => {
                      setRemoved(null);
                      void refresh();
                    }}
                  />
                </div>
              ) : (
                task && (
                  <div className="td-body">
                    <div className="td-head">
                      <span className="td-swatch" style={{ background: color }} aria-hidden="true" />
                      <div>
                        <h2 id="td-title" className={task.completed ? "is-done" : ""}>
                          {title}
                        </h2>
                        <p className="td-when">
                          {due
                            ? `Due ${formatTaskDay(task.date, new Date(), timezone)}`
                            : formatTaskWhen({ date: task.date, time: task.time, endTime: taskEndTime(task) }, new Date(), timezone)}
                        </p>
                      </div>
                    </div>

                    <div className="td-meta">
                      {course && <span className="td-chip">{course}</span>}
                      {categoryLabel(task) && <span className="td-chip is-quiet">{categoryLabel(task)}</span>}
                      {task.recurring?.enabled && <span className="td-chip is-quiet">Repeats</span>}
                      {plan && (
                        <Link href={`/projects/${plan.id}`} className="td-chip is-link" onClick={close}>
                          {plan.title}
                        </Link>
                      )}
                      {task.pathOrigin && (
                        <Link href={`/tangents/${task.pathOrigin.pathId}`} className="td-chip is-link" onClick={close}>
                          From {task.pathOrigin.pathTitle}
                        </Link>
                      )}
                    </div>

                    <fieldset className="td-section td-type" disabled={busy}>
                      <legend>Type</legend>
                      <div className="td-type-options">
                        {COMMITMENT_OPTIONS.map((option) => (
                          <label key={option.value} className="td-type-option">
                            <input
                              type="radio"
                              name="td-type"
                              checked={commitmentOf(task) === option.value}
                              onChange={() => void changeType(option.value)}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {typeChange && "actionId" in typeChange && (
                        <ActionReceipt
                          key={typeChange.actionId}
                          actionId={typeChange.actionId}
                          label="Type changed"
                          onUndone={() => void refresh()}
                        />
                      )}
                      {typeChange && "note" in typeChange && <p role="status">{typeChange.note}</p>}
                    </fieldset>

                    {task.startAction && (
                      <div className="td-section">
                        <h3>First step</h3>
                        <p>{task.startAction}</p>
                      </div>
                    )}

                    {planning && needsPlan && (
                      <p className="td-planning" role="status">
                        <span className="add-spinner" aria-hidden="true" /> Working out the steps…
                      </p>
                    )}

                    {task.notes && noteParts(task.notes)?.map((part) => (
                      <div key={part.label} className="td-section">
                        <h3>{part.label}</h3>
                        <p>{part.text}</p>
                      </div>
                    ))}

                    {task.notes && !noteParts(task.notes) && (
                      <div className="td-section">
                        <h3>Notes</h3>
                        <p className={`td-notes${moreNotes ? " is-open" : ""}`}>{task.notes}</p>
                        {task.notes.length > 180 && (
                          <button type="button" className="td-more" onClick={() => setMoreNotes((v) => !v)}>
                            {moreNotes ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}

                    {task.resources && task.resources.length > 0 && (
                      <div className="td-section">
                        <h3>Links</h3>
                        <ul className="td-links">
                          {task.resources.map((r, i) => (
                            <li key={`${r.url}-${i}`}>
                              <a href={r.url} target="_blank" rel="noreferrer">
                                {r.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="td-actions">
                      <button type="button" className={`td-primary lg lg-tint lg-interactive${task.completed ? " is-done" : ""}`} onClick={() => void toggle()} disabled={busy}>
                        <Check size={15} strokeWidth={2.6} aria-hidden="true" />
                        {task.completed ? "Done — undo" : "Mark done"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
