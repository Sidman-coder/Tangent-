"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppState } from "@/components/AppStateProvider";
import AddTaskModal from "@/components/AddTaskModal";
import TaskChatModal from "@/components/TaskChatModal";
import { WhatToDoNow } from "@/components/WhatToDoNow";
import { handleResourceClick } from "@/lib/task-utils";
import type { Task } from "@/lib/types";
import {
  CheckCircle2,
  Zap,
  Target,
  Clock,
  MessageCircle,
  X,
  Shuffle,
  RotateCcw,
  Repeat,
  PlusCircle,
  ChevronDown,
  Check,
  type LucideIcon,
} from "lucide-react";

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function recurringLabel(task: Task): string {
  const r = task.recurring;
  if (!r?.enabled) return "";
  const { frequency, daysOfWeek } = r;
  if (frequency === "daily") return "Every day";
  if (frequency === "monthly") return "Every month";
  if (frequency === "yearly") return "Every year";
  if (frequency === "weekly") {
    if (!daysOfWeek?.length) return "Weekly";
    if (daysOfWeek.length === 5 && [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d))) return "Every weekday";
    if (daysOfWeek.length === 2 && [0, 6].every((d) => daysOfWeek.includes(d))) return "Every weekend";
    if (daysOfWeek.length === 1) return `Every ${DAY_NAMES[daysOfWeek[0]]}`;
    return `Every ${daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}`;
  }
  return "";
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type RecurDeleteTarget = { taskId: string; parentId: string; title: string };

export default function TasksPage() {
  const { state, refresh } = useAppState();
  const [showModal, setShowModal] = useState(false);
  const [submitting] = useState(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  const [shuffleAnim, setShuffleAnim] = useState(false);
  const [chatTask, setChatTask] = useState<Task | null>(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState<RecurDeleteTarget | null>(null);
  const [recurDeleting, setRecurDeleting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [, setBannerTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setBannerTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const today = todayStr();

  const rawDailyTasks = (state?.tasks ?? [])
    .filter((t) => t.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));

  const displayTasks = shuffledIds
    ? shuffledIds.map((id) => rawDailyTasks.find((t) => t.id === id)).filter(Boolean) as Task[]
    : rawDailyTasks;

  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const overdueTask = rawDailyTasks.find((t) => !t.completed && timeToMinutes(t.time) <= currentMinutes);
  const nextTask = rawDailyTasks.find((t) => !t.completed && timeToMinutes(t.time) > currentMinutes);
  const minutesUntilNext = nextTask ? timeToMinutes(nextTask.time) - currentMinutes : null;
  const firstTask = rawDailyTasks[0];

  let dayBanner: { type: "overdue" | "get-ahead" | "all-done" | "between"; icon: LucideIcon; text: string } | null = null;
  if (rawDailyTasks.length > 0 && rawDailyTasks.every((t) => t.completed)) {
    dayBanner = { type: "all-done", icon: CheckCircle2, text: "All tasks complete for today. Great work." };
  } else if (overdueTask) {
    dayBanner = nextTask
      ? { type: "overdue", icon: Zap, text: `Complete your ${overdueTask.title} — your next task starts in ${formatDuration(minutesUntilNext!)}` }
      : { type: "overdue", icon: Zap, text: `Complete your ${overdueTask.title} — it's overdue` };
  } else if (nextTask && firstTask && nextTask.id === firstTask.id && !rawDailyTasks.some((t) => t.completed)) {
    dayBanner = { type: "get-ahead", icon: Target, text: `You can get ahead — ${nextTask.title} starts in ${formatDuration(minutesUntilNext!)}` };
  } else if (nextTask) {
    dayBanner = { type: "between", icon: Clock, text: `Next task: ${nextTask.title} at ${nextTask.time} — ${formatDuration(minutesUntilNext!)} away` };
  }

  useEffect(() => { setShuffledIds(null); }, [rawDailyTasks.length]);

  const handleShuffle = () => {
    setShuffledIds(shuffle(rawDailyTasks).map((t) => t.id));
    setShuffleAnim(true);
    setTimeout(() => setShuffleAnim(false), 400);
  };

  const toggleTask = useCallback(async (id: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task", id }),
    });
    await refresh();
  }, [refresh]);

  const handleDeleteTask = useCallback(async (t: Task) => {
    // If recurring, show modal
    if (t.recurring?.enabled && t.recurring.parentId) {
      setRecurDeleteTarget({ taskId: t.id, parentId: t.recurring.parentId, title: t.title });
      return;
    }
    // Single task — delete immediately
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_task", id: t.id }),
    });
    await refresh();
  }, [refresh]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirmRecurDelete = useCallback(async (deleteAll: boolean) => {
    if (!recurDeleteTarget) return;
    setRecurDeleting(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_recurring", id: recurDeleteTarget.taskId, deleteAll }),
    });
    setRecurDeleting(false);
    setRecurDeleteTarget(null);
    await refresh();
  }, [recurDeleteTarget, refresh]);

  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal]);

  const getTaskAccentColor = useCallback((t: Task): string | undefined => {
    if (t.planId) {
      const plan = (state?.plans ?? []).find((p) => p.id === t.planId);
      if (plan) return plan.color;
    }
    const cal = (state?.calendars ?? []).find((c) => c.id === t.calendarId);
    if (cal) {
      if (cal.category === "work") return "var(--cal-work)";
      if (cal.category === "personal") return "var(--cal-personal)";
      if (cal.category !== "ALL") return "var(--cal-all)";
    }
    return undefined;
  }, [state]);

  const TaskRow = ({ t, showFreqLabel = false }: { t: Task; showFreqLabel?: boolean }) => {
    const freq = recurringLabel(t);
    const accentColor = getTaskAccentColor(t);
    const hasDetails = Boolean(t.notes);
    const expanded = hasDetails && expandedIds.has(t.id);
    return (
      <div
        className={`task-card${t.completed ? " completed" : ""}${accentColor ? " plan-task-border" : ""}`}
        style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : undefined}
        onClick={() => hasDetails && toggleExpanded(t.id)}
      >
        <div className="task-card-top" style={hasDetails ? { cursor: "pointer" } : undefined}>
          <button
            type="button"
            className={`task-card-check${t.completed ? " checked" : ""}`}
            onClick={(e) => { e.stopPropagation(); void toggleTask(t.id); }}
            aria-label={`Mark ${t.title} complete`}
            aria-pressed={t.completed}
          >
            {t.completed && <Check size={11} strokeWidth={3} color="#ffffff" />}
          </button>
          <span
            className={`priority-dot ${t.priority}`}
            style={{ background: PRIORITY_COLOR[t.priority] }}
            title={`Priority: ${t.priority}`}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span className={`task-card-title${t.completed ? " done" : ""}`}>{t.title}</span>
              {t.recurring?.enabled && (
                <span className="recurring-badge" title={freq || "Recurring"}><Repeat size={12} strokeWidth={1.75} /></span>
              )}
            </div>
            {showFreqLabel && freq && (
              <div className="recurring-freq-label">{freq}</div>
            )}
          </div>
          <span className="task-card-time">{t.time}</span>
          <button
            className="task-chat-btn"
            onClick={(e) => { e.stopPropagation(); setChatTask(t); }}
            title="AI chat for this task"
            aria-label={`Open AI chat for ${t.title}`}
          >
            <MessageCircle size={18} strokeWidth={1.75} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); void handleDeleteTask(t); }}
            style={{
              background: "none", border: "none", color: "var(--text-2)",
              cursor: "pointer", padding: "0 0.25rem",
              lineHeight: 1, flexShrink: 0, display: "inline-flex", alignItems: "center",
            }}
            aria-label={`Delete ${t.title}`}
            title="Delete task"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
          {hasDetails && (
            <button
              type="button"
              className={`task-desc-chevron${expanded ? " open" : ""}`}
              onClick={(e) => { e.stopPropagation(); toggleExpanded(t.id); }}
              aria-label={expanded ? `Collapse details for ${t.title}` : `Expand details for ${t.title}`}
              aria-expanded={expanded}
            >
              <ChevronDown size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
        {hasDetails && (
          <div className={`task-card-desc-wrap${expanded ? " expanded" : ""}`}>
            <div className="task-card-divider" />
            <div className="task-card-desc">
              {t.notes}
              {t.resources && t.resources.length > 0 && (
                <div className="resource-links-section">
                  {t.resources.map((r, i) => (
                    <button key={`${r.url}-${i}`} type="button" onClick={(e) => { e.stopPropagation(); handleResourceClick(r, t); }} className="resource-link">
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <WhatToDoNow />

      <section className="card-md">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Today — {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {rawDailyTasks.length > 1 && (
              <>
                <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }} onClick={handleShuffle} title="Shuffle task order">
                  <Shuffle size={16} strokeWidth={1.75} /> Shuffle
                </button>
                {shuffledIds && (
                  <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }} onClick={() => setShuffledIds(null)} title="Reset to time order">
                    <RotateCcw size={16} strokeWidth={1.75} /> Reset
                  </button>
                )}
              </>
            )}
            <button className="neu-btn-primary" style={{ fontSize: "0.82rem", padding: "0.4rem 0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }} onClick={() => setShowModal(true)}>
              <PlusCircle size={16} strokeWidth={1.75} /> Add task
            </button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: "0.35rem", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
          {rawDailyTasks.length === 0
            ? "No tasks yet — add one above or use the AI assistant."
            : `${rawDailyTasks.filter((t) => t.completed).length} of ${rawDailyTasks.length} complete`}
        </p>
        {dayBanner && (
          <div className={`day-banner ${dayBanner.type}`}>
            <span className="day-banner-icon">
              <dayBanner.icon size={18} strokeWidth={1.75} />
            </span>
            <span className="day-banner-text font-body">{dayBanner.text}</span>
          </div>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className={shuffleAnim ? "shuffle-anim" : ""}>
          {displayTasks.map((t) => (
            <li key={t.id}><TaskRow t={t} showFreqLabel /></li>
          ))}
        </ul>
        {rawDailyTasks.length > 0 && (
          <button className="add-task-btn neu-btn-primary" onClick={() => setShowModal(true)}>
            <PlusCircle size={16} strokeWidth={1.75} /> Add another task
          </button>
        )}
      </section>

      {/* Add Task Modal */}
      {showModal && (
        <AddTaskModal
          initialDate={today}
          onClose={() => setShowModal(false)}
          onSuccess={() => void refresh()}
        />
      )}

      {/* Recurring delete confirmation modal */}
      {recurDeleteTarget && (
        <div className="modal-overlay" onClick={() => setRecurDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3>Delete recurring task</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.5rem 0 1.25rem" }}>
              <strong style={{ color: "var(--text)" }}>{recurDeleteTarget.title}</strong> is a recurring task. Do you want to delete just this occurrence, or all occurrences?
            </p>
            <div className="modal-actions">
              <button className="btn-ghost surface-action-secondary" onClick={() => setRecurDeleteTarget(null)} disabled={recurDeleting}>Cancel</button>
              <button className="btn-ghost" onClick={() => void confirmRecurDelete(false)} disabled={recurDeleting}>
                {recurDeleting ? "Deleting…" : "Just this one"}
              </button>
              <button className="btn" onClick={() => void confirmRecurDelete(true)} disabled={recurDeleting}
                style={{ background: "linear-gradient(135deg,#7f1d1d,#991b1b)", borderColor: "#ef4444" }}>
                {recurDeleting ? "Deleting…" : "All occurrences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Chat Modal */}
      {chatTask && (
        <TaskChatModal task={chatTask} onClose={() => setChatTask(null)} />
      )}
    </>
  );
}
