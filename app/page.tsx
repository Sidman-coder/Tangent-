"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import MonthRhythm from "@/components/MonthRhythm";
import SchedulePulse from "@/components/SchedulePulse";
import Button from "@/components/ui/Button";
import FocusPanel from "@/components/ui/FocusPanel";
import PageHeader from "@/components/ui/PageHeader";
import TaskRow from "@/components/ui/TaskRow";
import type { ActionRecord, Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";
import { getSchedulePulse } from "@/lib/schedule-insights";

const KIND_COLOR = {
  school: "var(--kind-school)",
  "academic-ec": "var(--kind-academic-ec)",
  "side-ec": "var(--kind-side-ec)",
  commitment: "var(--kind-commitment)",
  personal: "var(--kind-personal)",
};

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 21) return "Good evening.";
  return "Still going?";
}

function startOfWeekMonday(d: Date): Date {
  const diff = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

export default function DashboardPage() {
  const router = useRouter();
  const { state, loading, error, refresh } = useAppState();
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [greeting, setGreeting] = useState("");
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => toYMD(now), [now]);

  useEffect(() => {
    const name = localStorage.getItem("tangent-user-name")?.trim();
    setGreeting(name ? getGreeting(name) : greetingFor(new Date().getHours()));
  }, []);

  const loadRecentActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: ActionRecord[] };
      if (data.ok && data.actions) setRecentActions(data.actions.slice(0, 3));
    } catch {
      // Recent activity is best-effort and should never block the decision surface.
    }
  }, []);

  useEffect(() => {
    void loadRecentActions();
  }, [loadRecentActions]);

  const calendars = state?.calendars ?? [];
  const tasks = useMemo(() => state?.tasks ?? [], [state]);
  const todaysTasks = useMemo(
    () => tasks.filter((task) => task.date === today).slice().sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, today]
  );
  const focusTask = useMemo(() => todaysTasks.find((task) => !task.completed) ?? null, [todaysTasks]);
  const daylineTasks = useMemo(
    () => todaysTasks.filter((task) => task.id !== focusTask?.id),
    [focusTask?.id, todaysTasks]
  );
  const completedToday = todaysTasks.filter((task) => task.completed).length;
  const insight = useMemo(() => getSchedulePulse(tasks, now), [now, tasks]);

  const weekDays = useMemo(() => {
    const monday = startOfWeekMonday(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      return { date, ymd: toYMD(date) };
    });
  }, [now]);

  const colorForTask = useCallback((task: Task): string => {
    if (task.kind) return KIND_COLOR[task.kind];
    const calendar = calendars.find((candidate) => candidate.id === task.calendarId);
    if (calendar) {
      if (calendar.category === "work") return "var(--cal-work)";
      if (calendar.category === "personal") return "var(--cal-personal)";
      if (calendar.category !== "ALL") return "var(--cal-all)";
    }
    return KIND_COLOR.personal;
  }, [calendars]);

  const toggleTask = useCallback(async (task: Task) => {
    if (completingTaskId) return;
    setCompletingTaskId(task.id);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_task", id: task.id }),
      });
      await refresh();
    } finally {
      setCompletingTaskId(null);
    }
  }, [completingTaskId, refresh]);

  const openCapture = () => window.dispatchEvent(new Event("tangent:open-palette"));
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  if (loading && !state) {
    return (
      <div className="today-page" aria-busy="true">
        <div className="today-loading-heading" />
        <div className="today-overview-grid">
          <div className="today-loading-focus" />
          <div className="today-loading-month" />
        </div>
        <div className="today-loading-rows"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="today-page">
      <PageHeader
        eyebrow="Your day"
        title={greeting || "Today"}
        description={
          <span className="today-date-line">
            {dateLabel}
            {todaysTasks.length > 0 && <span>{completedToday} of {todaysTasks.length} complete</span>}
          </span>
        }
        actions={
          <Button variant="primary" onClick={openCapture} icon={<Plus size={16} aria-hidden="true" />}>
            New task
          </Button>
        }
      />

      {error && <p className="today-inline-error" role="status">Your schedule could not refresh. Showing the latest available view.</p>}

      <div className="today-overview-grid">
        <FocusPanel
          task={focusTask}
          kindColor={focusTask ? colorForTask(focusTask) : "var(--accent)"}
          relativeLabel="Up next"
          onComplete={focusTask ? () => void toggleTask(focusTask) : undefined}
          onOpen={focusTask ? () => router.push("/tasks") : undefined}
          completing={completingTaskId === focusTask?.id}
        />
        <MonthRhythm tasks={tasks} year={now.getFullYear()} monthIndex={now.getMonth()} />
      </div>

      <div className="today-content-grid">
        <section className="today-dayline" aria-labelledby="today-dayline-title">
          <div className="today-section-heading">
            <div>
              <span className="today-section-label">Today</span>
              <h2 id="today-dayline-title">{focusTask ? "What comes next" : "Your schedule"}</h2>
            </div>
            <span>{todaysTasks.length} task{todaysTasks.length === 1 ? "" : "s"}</span>
          </div>

          {daylineTasks.length > 0 ? (
            <div className="today-dayline-list">
              {daylineTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  kindColor={colorForTask(task)}
                  onComplete={() => void toggleTask(task)}
                  onOpen={() => router.push("/tasks")}
                />
              ))}
            </div>
          ) : (
            <div className="today-empty-line">
              <p>{focusTask ? "No more tasks are scheduled after this one." : "Nothing is scheduled for today."}</p>
              {!focusTask && <Button variant="secondary" size="sm" onClick={openCapture}>Add a task</Button>}
            </div>
          )}
        </section>

        <aside className="today-insights" aria-label="Schedule context">
          <SchedulePulse insight={insight} />

          <section className="week-preview" aria-labelledby="week-preview-title">
            <div className="today-section-heading week-preview-heading">
              <div>
                <span className="today-section-label">At a glance</span>
                <h2 id="week-preview-title">This week</h2>
              </div>
            </div>
            <div className="week-preview-grid">
              {weekDays.map(({ date, ymd }, index) => {
                const dayTasks = tasks.filter((task) => task.date === ymd);
                const isToday = ymd === today;
                return (
                  <div key={ymd} className={`week-preview-day${isToday ? " is-today" : ""}`}>
                    <span className="week-preview-letter">{WEEK_LETTERS[index]}</span>
                    <span className="week-preview-number">{date.getDate()}</span>
                    <span className="week-preview-density" aria-label={`${dayTasks.length} scheduled task${dayTasks.length === 1 ? "" : "s"}`}>
                      {dayTasks.length > 0
                        ? dayTasks.slice(0, 3).map((task) => <i key={task.id} style={{ background: colorForTask(task) }} />)
                        : <i className="is-empty" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {recentActions.length > 0 && (
        <details className="today-recent">
          <summary>Recent activity <span>{recentActions.length}</span></summary>
          <div className="today-recent-list">
            {recentActions.map((action) => (
              <ActionReceipt
                key={action.id}
                actionId={action.id}
                label={action.summary}
                undoable={action.undoable}
                initiallyUndone={action.undone}
                onUndone={() => {
                  void refresh();
                  void loadRecentActions();
                }}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
