"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import type { ActionRecord, Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const EST_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function estTimeFor(d: Date): string {
  return `${EST_TIME_FORMATTER.format(d)} EST`;
}

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Still going";
}

function startOfWeekMonday(d: Date): Date {
  const diff = (d.getDay() + 6) % 7; // days since Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}

export default function DashboardPage() {
  const { state, refresh } = useAppState();
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [estTime, setEstTime] = useState<string | null>(null);

  const loadRecentActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: ActionRecord[] };
      if (data.ok && data.actions) setRecentActions(data.actions.slice(0, 3));
    } catch {
      // ignore — recent activity is best-effort
    }
  }, []);

  useEffect(() => {
    void loadRecentActions();
  }, [loadRecentActions]);

  useEffect(() => {
    const update = () => setEstTime(estTimeFor(new Date()));
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);
  const today = useMemo(() => toYMD(new Date()), []);

  const calendars = state?.calendars ?? [];
  const tasks = useMemo(() => state?.tasks ?? [], [state]);

  const todaysTasks = useMemo(() => tasks.filter((t) => t.date === today), [tasks, today]);
  const completedToday = todaysTasks.filter((t) => t.completed).length;

  const focusTask = useMemo(() => {
    const incomplete = todaysTasks.filter((t) => !t.completed);
    if (incomplete.length === 0) return null;
    return incomplete.slice().sort((a, b) => a.time.localeCompare(b.time))[0];
  }, [todaysTasks]);

  const weekDays = useMemo(() => {
    const monday = startOfWeekMonday(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return { date: d, ymd: toYMD(d) };
    });
  }, []);

  const dotColorForTask = useCallback(
    (t: Task): string => {
      const cal = calendars.find((c) => c.id === t.calendarId);
      if (cal) {
        if (cal.category === "work") return "var(--cal-work)";
        if (cal.category === "personal") return "var(--cal-personal)";
        if (cal.category !== "ALL") return "var(--cal-all)";
      }
      return PRIORITY_COLOR[t.priority];
    },
    [calendars]
  );

  const [markingDone, setMarkingDone] = useState(false);

  const markFocusDone = useCallback(async () => {
    if (!focusTask || markingDone) return;
    setMarkingDone(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_task", id: focusTask.id }),
      });
      await refresh();
    } finally {
      setMarkingDone(false);
    }
  }, [focusTask, markingDone, refresh]);

  return (
    <div className="dash-page">
      <p className="dash-greeting-line">
        {greeting}, Sid.{estTime && <>&nbsp;·&nbsp;{estTime}</>}
      </p>

      <div className="dash-focus-strip neu-inset-groove">
        <div className="dash-focus-main">
          <span className="dash-focus-label">Focus now</span>
          {focusTask ? (
            <span className="dash-focus-title">{focusTask.title}</span>
          ) : (
            <span className="dash-focus-empty">Nothing scheduled. Add something below.</span>
          )}
        </div>
        {focusTask && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <span className="dash-focus-time">{focusTask.time}</span>
            <button
              type="button"
              className="neu-btn-primary"
              style={{ padding: "6px 14px", fontSize: "13px", cursor: "pointer" }}
              onClick={() => void markFocusDone()}
              disabled={markingDone}
            >
              {markingDone ? "Marking…" : "Mark done"}
            </button>
          </div>
        )}
      </div>

      <div className="dash-week-strip">
        {weekDays.map(({ date, ymd }, i) => {
          const dayTasks = tasks.filter((t) => t.date === ymd);
          const isToday = ymd === today;
          return (
            <div key={ymd} className={isToday ? "dash-week-day is-today" : "dash-week-day"}>
              <span className="dash-week-day-letter">{WEEK_LETTERS[i]}</span>
              <span className="dash-week-day-num">{date.getDate()}</span>
              <span className="dash-week-dots">
                {dayTasks.length === 0 ? (
                  <span className="dash-week-dot-empty" />
                ) : (
                  dayTasks.slice(0, 3).map((t) => (
                    <span key={t.id} className="dash-week-dot" style={{ background: dotColorForTask(t) }} />
                  ))
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="dash-bottom-row">
        <div className="dash-stats-card card-md dash-stats-card-full">
          <span className="dash-stats-label">Today</span>
          <span className="dash-stats-number">{todaysTasks.length}</span>
          <span className="dash-stats-sub">
            {completedToday} complete · {todaysTasks.length - completedToday} remaining
          </span>
          <div className="dash-progress-track">
            <div
              className="dash-progress-fill"
              style={{ width: todaysTasks.length ? `${(completedToday / todaysTasks.length) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </div>

      <section className="dash-recent">
        <h2 className="dash-recent-heading">Recent</h2>
        {recentActions.length === 0 ? (
          <p className="dash-recent-empty">No recent activity.</p>
        ) : (
          recentActions.map((a) => (
            <div key={a.id} className="dash-recent-row">
              <ActionReceipt
                actionId={a.id}
                label={a.summary}
                undoable={a.undoable}
                initiallyUndone={a.undone}
                onUndone={() => {
                  void refresh();
                  void loadRecentActions();
                }}
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
