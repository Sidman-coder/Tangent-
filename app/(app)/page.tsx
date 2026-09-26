"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Plus } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import MonthRhythm from "@/components/MonthRhythm";
import AttentionSection, { type AttentionReceipt } from "@/components/dashboard/AttentionSection";
import WeekAhead from "@/components/dashboard/WeekAhead";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import TaskRow from "@/components/ui/TaskRow";
import type { ActionRecord, Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";
import { riseIn, rowPresence, spring, staggerChildren } from "@/lib/motion";
import { getSchedulePulse } from "@/lib/schedule-insights";
import { taskColor } from "@/lib/task-colors";
import { getUrgency, tracksCompletion } from "@/lib/urgency";

type Override = Partial<Pick<Task, "completed" | "date" | "time">>;

const RECEIPT_MS = 6000;

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 21) return "Good evening.";
  return "Still going?";
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.ok === false) throw new Error(String(data.error ?? "Request failed"));
  return data;
}

export default function DashboardPage() {
  const router = useRouter();
  const { state, loading, error, refresh } = useAppState();
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [greeting, setGreeting] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<AttentionReceipt | null>(null);
  const receiptSeq = useRef(0);

  // "Starts in 40 min" and "missed earlier today" drift, so keep the clock live.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const name = localStorage.getItem("tangent-user-name")?.trim();
    setGreeting(name ? getGreeting(name) : greetingFor(new Date().getHours()));
  }, []);

  useEffect(() => {
    if (!receipt) return;
    const id = window.setTimeout(() => setReceipt(null), RECEIPT_MS);
    return () => window.clearTimeout(id);
  }, [receipt]);

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

  const serverTasks = useMemo(() => state?.tasks ?? [], [state]);

  // Drop each optimistic override once the polled server state agrees with it.
  useEffect(() => {
    setOverrides((current) => {
      const ids = Object.keys(current);
      if (ids.length === 0) return current;
      const next = { ...current };
      for (const id of ids) {
        const server = serverTasks.find((t) => t.id === id);
        const o = current[id];
        const settled = !server || (Object.keys(o) as (keyof Override)[]).every((k) => server[k] === o[k]);
        if (settled) delete next[id];
      }
      return Object.keys(next).length === ids.length ? current : next;
    });
  }, [serverTasks]);

  const tasks = useMemo(
    () => serverTasks.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t)),
    [overrides, serverTasks]
  );

  const today = toYMD(now);
  const plans = state?.plans;
  const calendars = state?.calendars;
  const colorForTask = useCallback(
    (task: Task) => taskColor(task, plans ?? [], calendars ?? []),
    [calendars, plans]
  );

  const urgency = useMemo(() => getUrgency(tasks, now), [now, tasks]);
  const attentionIds = useMemo(() => new Set(urgency.items.map((i) => i.task.id)), [urgency]);
  const insight = useMemo(() => getSchedulePulse(tasks, now), [now, tasks]);

  const todaysTasks = useMemo(
    () => tasks.filter((t) => t.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, today]
  );
  const trackableToday = todaysTasks.filter(tracksCompletion);
  const completedToday = trackableToday.filter((t) => t.completed).length;
  // Today's list shows what the attention section doesn't, open work first.
  const dayline = useMemo(
    () =>
      todaysTasks
        .filter((t) => !attentionIds.has(t.id))
        .sort((a, b) => Number(a.completed) - Number(b.completed) || a.time.localeCompare(b.time)),
    [attentionIds, todaysTasks]
  );
  const todayInAttention = todaysTasks.filter((t) => attentionIds.has(t.id)).length;
  const dayRemaining = dayline.filter((t) => !t.completed && tracksCompletion(t)).length;

  const nextTask = useMemo(() => {
    const nowTime = hhmm(now);
    return (
      tasks
        .filter((t) => !t.completed && tracksCompletion(t) && (t.date > today || (t.date === today && t.time >= nowTime)))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] ?? null
    );
  }, [now, tasks, today]);

  const withOverride = useCallback(
    async (task: Task, override: Override, run: () => Promise<void>): Promise<boolean> => {
      setBusyTaskId(task.id);
      setOverrides((o) => ({ ...o, [task.id]: { ...o[task.id], ...override } }));
      try {
        await run();
        await refresh();
        void loadRecentActions();
        return true;
      } catch {
        setOverrides((o) => {
          const next = { ...o };
          delete next[task.id];
          return next;
        });
        return false;
      } finally {
        setBusyTaskId(null);
      }
    },
    [loadRecentActions, refresh]
  );

  const setCompleted = useCallback(
    (task: Task, completed: boolean) =>
      withOverride(task, { completed }, async () => {
        await postJson("/api/tasks", { action: "update_task", id: task.id, completed });
      }),
    [withOverride]
  );

  const completeFromAttention = useCallback(
    (task: Task) => {
      void setCompleted(task, true).then((ok) =>
        ok && setReceipt({
          id: ++receiptSeq.current,
          label: `Completed “${task.title}”`,
          onUndo: () => {
            setReceipt(null);
            void setCompleted(task, false);
          },
        })
      );
    },
    [setCompleted]
  );

  const moveToTomorrow = useCallback(
    (task: Task) => {
      const tomorrow = toYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      let actionId: string | null = null;
      void withOverride(task, { date: tomorrow }, async () => {
        const data = await postJson("/api/reschedule", { taskId: task.id, suggestedDate: tomorrow, suggestedTime: task.time });
        actionId = typeof data.actionId === "string" ? data.actionId : null;
      }).then((ok) => {
        if (!ok || !actionId) return;
        const id = actionId;
        setReceipt({
          id: ++receiptSeq.current,
          label: `Moved “${task.title}” to tomorrow`,
          onUndo: () => {
            setReceipt(null);
            void withOverride(task, { date: task.date }, async () => {
              await postJson("/api/actions", { id });
            });
          },
        });
      });
    },
    [now, withOverride]
  );

  const openCapture = () => window.dispatchEvent(new Event("tangent:open-palette"));
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now);

  if (loading && !state) {
    return (
      <div className="today-page" aria-busy="true">
        <div className="today-loading-heading" />
        <div className="today-loading-attention" />
        <div className="today-insights">
          <div className="today-loading-month" />
          <div className="today-loading-month" />
        </div>
        <div className="today-loading-rows"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <m.div className="today-page" variants={staggerChildren} initial="hidden" animate="show">
      <m.div variants={riseIn}>
        <PageHeader
          eyebrow="Your day"
          title={greeting || "Today"}
          description={
            <span className="today-date-line">
              {dateLabel}
              {trackableToday.length > 0 && <span>{completedToday} of {trackableToday.length} complete</span>}
            </span>
          }
          actions={
            <Button variant="primary" onClick={openCapture} icon={<Plus size={16} aria-hidden="true" />}>
              New task
            </Button>
          }
        />
      </m.div>

      {error && <p className="today-inline-error" role="status">Your schedule could not refresh. Showing the latest available view.</p>}

      <AttentionSection
        urgency={urgency}
        today={today}
        nextTask={nextTask}
        colorForTask={colorForTask}
        busyTaskId={busyTaskId}
        receipt={receipt}
        onComplete={completeFromAttention}
        onTomorrow={moveToTomorrow}
        onOpen={(task) => router.push(`/calendar?date=${task.date}`)}
        onSeeAll={() => router.push("/tasks")}
      />

      <aside className="today-insights" aria-label="Schedule context">
        <WeekAhead tasks={tasks} now={now} insight={insight} />
        <MonthRhythm tasks={tasks} year={now.getFullYear()} monthIndex={now.getMonth()} today={today} />
      </aside>

      <m.section variants={riseIn} className="today-dayline" aria-labelledby="today-dayline-title">
        <div className="today-section-heading">
          <div>
            <span className="today-section-label">Today</span>
            <h2 id="today-dayline-title">{todayInAttention > 0 ? "The rest of today" : "Your day"}</h2>
          </div>
          <span>
            {dayRemaining} left
            {todayInAttention > 0 && <> · {todayInAttention} above</>}
          </span>
        </div>

        {dayline.length > 0 ? (
          <div className="today-dayline-list">
            <AnimatePresence initial={false}>
              {dayline.map((task) => (
                <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence}>
                  <TaskRow
                    task={task}
                    kindColor={colorForTask(task)}
                    onComplete={tracksCompletion(task) ? () => void setCompleted(task, !task.completed) : undefined}
                    onOpen={() => router.push(`/calendar?date=${task.date}`)}
                  />
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="today-empty-line">
            <p>{todayInAttention > 0 ? "Nothing else is scheduled today." : "Nothing is scheduled for today."}</p>
            <Button variant="secondary" size="sm" onClick={openCapture}>Add a task</Button>
          </div>
        )}
      </m.section>

      {recentActions.length > 0 && (
        <m.details variants={riseIn} className="today-recent">
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
        </m.details>
      )}
    </m.div>
  );
}
