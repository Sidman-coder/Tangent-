"use client";

// One task, opened in the middle of the screen — like an event in Google
// Calendar. Every place a task is clicked (calendar month/week/agenda,
// Today, projects) opens this through openTask(); the day panel is only for
// clicking a date.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { CalendarDays, Check, MessageSquareText, Trash2, X } from "lucide-react";
import ActionReceipt from "@/components/ActionReceipt";
import TaskChatModal from "@/components/TaskChatModal";
import { useAppState } from "@/components/AppStateProvider";
import { splitCourse } from "@/lib/course";
import { formatTime12 } from "@/lib/dates";
import { KIND_LABEL, taskColor } from "@/lib/task-colors";
import type { Task } from "@/lib/types";
import "./task-detail.css";

export const OPEN_TASK_EVENT = "tangent:open-task";

/** Open a task in the centred card. */
export function openTask(taskId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_TASK_EVENT, { detail: { taskId } }));
}

function longDate(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function TaskDetail() {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreNotes, setMoreNotes] = useState(false);
  const [removed, setRemoved] = useState<{ actionId: string; title: string } | null>(null);
  const [chat, setChat] = useState<Task | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const task = taskId ? state?.tasks.find((t) => t.id === taskId) ?? null : null;
  const plan = task?.planId ? state?.plans.find((p) => p.id === task.planId) ?? null : null;

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ taskId: string }>).detail?.taskId;
      if (!id) return;
      setRemoved(null);
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
      if (e.key === "Escape" && !chat) close();
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => cardRef.current?.focus(), 30);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, chat, close]);

  const post = async (body: unknown) => {
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({}))) as { ok?: boolean; actionId?: string };
  };

  const toggle = async () => {
    if (!task) return;
    setBusy(true);
    await post({ action: "update_task", id: task.id, completed: !task.completed });
    await refresh();
    setBusy(false);
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
  const color = task ? taskColor(task, state?.plans ?? []) : "var(--accent)";

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
                    <button type="button" className="td-icon lg lg-interactive" onClick={() => setChat(task)} aria-label="Get help with this" title="Help">
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
                          {due ? `Due ${longDate(task.date)}` : `${longDate(task.date)}${task.time ? ` · ${formatTime12(task.time)}` : ""}`}
                        </p>
                      </div>
                    </div>

                    <div className="td-meta">
                      {course && <span className="td-chip">{course}</span>}
                      {task.kind && <span className="td-chip is-quiet">{KIND_LABEL[task.kind]}</span>}
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

                    {task.startAction && (
                      <div className="td-section">
                        <h3>First step</h3>
                        <p>{task.startAction}</p>
                      </div>
                    )}

                    {task.notes && (
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
                      <button
                        type="button"
                        className="td-secondary lg lg-interactive"
                        onClick={() => {
                          close();
                          router.push(`/calendar?date=${task.date}`);
                        }}
                      >
                        <CalendarDays size={15} aria-hidden="true" /> See the day
                      </button>
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
      {chat && <TaskChatModal task={chat} onClose={() => setChat(null)} />}
    </>,
    document.body
  );
}
