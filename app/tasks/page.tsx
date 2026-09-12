"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAppState } from "@/components/AppStateProvider";
import AddTaskModal from "@/components/AddTaskModal";
import TaskChatModal from "@/components/TaskChatModal";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import ProductTaskRow from "@/components/ui/TaskRow";
import { handleResourceClick } from "@/lib/task-utils";
import { formatTime12 } from "@/lib/dates";
import type { Task } from "@/lib/types";
import {
  CheckCircle2,
  Zap,
  Target,
  Clock,
  MessageCircle,
  Trash2,
  Shuffle,
  RotateCcw,
  Plus,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

const KIND_COLOR = {
  school: "var(--kind-school)",
  "academic-ec": "var(--kind-academic-ec)",
  "side-ec": "var(--kind-side-ec)",
  commitment: "var(--kind-commitment)",
  personal: "var(--kind-personal)",
};
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
  const { state, loading, error, refresh } = useAppState();
  const [showModal, setShowModal] = useState(false);
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  const [shuffleAnim, setShuffleAnim] = useState(false);
  const [chatTask, setChatTask] = useState<Task | null>(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState<RecurDeleteTarget | null>(null);
  const [recurDeleting, setRecurDeleting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [, setBannerTick] = useState(0);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setBannerTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const prefersReducedMotion = useMemo(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ), []);

  const today = todayStr();

  const rawDailyTasks = (state?.tasks ?? [])
    .filter((t) => t.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));

  const displayTasks = shuffledIds
    ? shuffledIds.map((id) => rawDailyTasks.find((t) => t.id === id)).filter(Boolean) as Task[]
    : rawDailyTasks;
  const incompleteTasks = displayTasks.filter((t) => !t.completed || completingIds.has(t.id));
  const completedTasks = displayTasks.filter((t) => t.completed && !completingIds.has(t.id));

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
    dayBanner = { type: "between", icon: Clock, text: `Next task: ${nextTask.title} at ${formatTime12(nextTask.time)} — ${formatDuration(minutesUntilNext!)} away` };
  }

  const urgentTask = overdueTask ?? nextTask ?? null;

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

  const getTaskAccentColor = useCallback((t: Task): string => {
    if (t.kind) return KIND_COLOR[t.kind];
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
    return KIND_COLOR.personal;
  }, [state]);

  const handleCheckToggle = useCallback((t: Task) => {
    if (!t.completed && !prefersReducedMotion) {
      setCompletingIds((prev) => new Set(prev).add(t.id));
      void toggleTask(t.id);
      setTimeout(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(t.id);
          return next;
        });
      }, 300);
    } else {
      void toggleTask(t.id);
    }
  }, [prefersReducedMotion, toggleTask]);

  const renderTask = (task: Task) => {
    const hasDetails = Boolean(task.notes || task.resources?.length);
    const expanded = hasDetails && expandedIds.has(task.id);
    const completing = completingIds.has(task.id);
    return (
      <div key={task.id} className={completing ? "task-completing" : undefined}>
        <ProductTaskRow
          task={task}
          kindColor={getTaskAccentColor(task)}
          expanded={expanded}
          onComplete={() => handleCheckToggle(task)}
          onOpen={hasDetails ? () => toggleExpanded(task.id) : undefined}
          actions={
            <>
              <button
                type="button"
                className="task-row-icon-button"
                onClick={() => setChatTask(task)}
                title="Ask about this task"
                aria-label={`Ask about ${task.title}`}
              >
                <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="task-row-icon-button task-row-icon-button--danger"
                onClick={() => void handleDeleteTask(task)}
                aria-label={`Delete ${task.title}`}
                title="Delete task"
              >
                <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {hasDetails && (
                <button
                  type="button"
                  className={`task-row-icon-button${expanded ? " is-open" : ""}`}
                  onClick={() => toggleExpanded(task.id)}
                  aria-label={expanded ? `Collapse details for ${task.title}` : `Expand details for ${task.title}`}
                  aria-expanded={expanded}
                >
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
            </>
          }
        >
          {task.notes && <p className="task-row-notes">{task.notes}</p>}
          {task.recurring?.enabled && <p className="task-row-recurrence">{recurringLabel(task)}</p>}
          {task.resources && task.resources.length > 0 && (
            <div className="resource-links-section">
              {task.resources.map((resource, index) => (
                <button
                  key={`${resource.url}-${index}`}
                  type="button"
                  onClick={() => handleResourceClick(resource, task)}
                  className="resource-link"
                >
                  {resource.label}
                </button>
              ))}
            </div>
          )}
        </ProductTaskRow>
      </div>
    );
  };

  if (loading && !state) {
    return <div className="tasks-page tasks-page--loading" aria-busy="true"><span /><span /><span /></div>;
  }

  const completeCount = rawDailyTasks.filter((task) => task.completed).length;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <div className="tasks-page">
        <PageHeader
          eyebrow="Daily plan"
          title="Tasks"
          description={`${dateLabel} · ${completeCount} of ${rawDailyTasks.length} complete`}
          actions={
            <Button variant="primary" onClick={() => setShowModal(true)} icon={<Plus size={16} aria-hidden="true" />}>
              New task
            </Button>
          }
        />

        <div className="sticky-focus-bar">
          {urgentTask ? (
            <>
              <span className="sticky-focus-label">Current focus</span>
              <span className="sticky-focus-pill" style={{ background: getTaskAccentColor(urgentTask) }} />
              <span className="sticky-focus-title">{urgentTask.title}</span>
              <span className="sticky-focus-time">
                {urgentTask.id === overdueTask?.id ? "Now" : `In ${formatDuration(timeToMinutes(urgentTask.time) - currentMinutes)}`}
              </span>
              <Button variant="quiet" size="sm" onClick={() => handleCheckToggle(urgentTask)}>Done</Button>
            </>
          ) : (
            <span className="sticky-focus-empty">All clear today. Add a task when you’re ready.</span>
          )}
        </div>

        {error && <p className="tasks-inline-error" role="status">Tasks could not refresh. Showing the latest available list.</p>}

        <div className="tasks-toolbar">
          {dayBanner ? (
            <div className={`tasks-status tasks-status--${dayBanner.type}`}>
              <dayBanner.icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{dayBanner.text}</span>
            </div>
          ) : (
            <span className="tasks-status tasks-status--quiet">Your day is ready.</span>
          )}
          {rawDailyTasks.length > 1 && (
            <div className="tasks-utilities">
              <Button variant="quiet" size="sm" onClick={handleShuffle} icon={<Shuffle size={14} aria-hidden="true" />}>
                Shuffle
              </Button>
              {shuffledIds && (
                <Button variant="quiet" size="sm" onClick={() => setShuffledIds(null)} icon={<RotateCcw size={14} aria-hidden="true" />}>
                  Reset
                </Button>
              )}
            </div>
          )}
        </div>

        <section className="tasks-group" aria-labelledby="tasks-incomplete-heading">
          <div className="tasks-group-heading">
            <h2 id="tasks-incomplete-heading">To do</h2>
            <span>{incompleteTasks.length}</span>
          </div>
          <div className={`tasks-list${shuffleAnim ? " shuffle-anim" : ""}`}>
            {incompleteTasks.length > 0 ? incompleteTasks.map(renderTask) : (
              <div className="tasks-empty-state">
                <p>No incomplete tasks for today.</p>
                <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>Add a task</Button>
              </div>
            )}
          </div>
        </section>

        {completedTasks.length > 0 && (
          <section className="tasks-group tasks-group--completed" aria-labelledby="tasks-completed-heading">
            <div className="tasks-group-heading">
              <h2 id="tasks-completed-heading">Completed</h2>
              <span>{completedTasks.length}</span>
            </div>
            <div className="tasks-list">{completedTasks.map(renderTask)}</div>
          </section>
        )}
      </div>

      {showModal && (
        <AddTaskModal
          initialDate={today}
          onClose={() => setShowModal(false)}
          onSuccess={() => void refresh()}
        />
      )}

      {recurDeleteTarget && (
        <div className="modal-overlay" onClick={() => setRecurDeleteTarget(null)}>
          <div className="modal task-recur-modal" role="dialog" aria-modal="true" aria-labelledby="recur-delete-title" onClick={(event) => event.stopPropagation()}>
            <span className="modal-kicker">Recurring task</span>
            <h3 id="recur-delete-title">Delete “{recurDeleteTarget.title}”?</h3>
            <p>Choose whether to remove only today’s occurrence or the complete recurring series.</p>
            <div className="modal-actions">
              <Button variant="quiet" onClick={() => setRecurDeleteTarget(null)} disabled={recurDeleting}>Cancel</Button>
              <Button variant="secondary" onClick={() => void confirmRecurDelete(false)} loading={recurDeleting} loadingLabel="Deleting…">Just this one</Button>
              <Button variant="danger" onClick={() => void confirmRecurDelete(true)} loading={recurDeleting} loadingLabel="Deleting…">All occurrences</Button>
            </div>
          </div>
        </div>
      )}

      {chatTask && <TaskChatModal task={chatTask} onClose={() => setChatTask(null)} />}
    </>
  );
}
