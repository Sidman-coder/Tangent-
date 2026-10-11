"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { localNow, wallClockNow } from "@/lib/time";
import ActionReceipt from "@/components/ActionReceipt";
import { openTask } from "@/components/TaskDetail";
import TaskChatModal from "@/components/TaskChatModal";
import TodayCard, { type AttentionReceipt } from "@/components/dashboard/TodayCard";
import WeekStrip from "@/components/dashboard/WeekStrip";
import SetupNudge from "@/components/dashboard/SetupNudge";
import AddFlow from "@/components/add/AddFlow";
import { CanvasCard, StartingIntentCard } from "@/components/dashboard/HomeCards";
import PageHeader from "@/components/ui/PageHeader";
import "@/components/dashboard/today-home.css";
import type { ActionRecord, Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";
import { riseIn, staggerChildren } from "@/lib/motion";
import { prefsOf } from "@/lib/personalize";
import { getSchedulePulse } from "@/lib/schedule-insights";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import QuestionsInbox from "@/components/dashboard/QuestionsInbox";
import { useQuestionSets } from "@/hooks/useQuestionSets";
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
  const tz = useUserTimezone();
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [greeting, setGreeting] = useState("");
  // Wall clock in the student's own timezone (profiles.timezone), so "today",
  // week-ahead and the monthly heatmap follow it rather than the browser's.
  const [now, setNow] = useState(() => wallClockNow(tz));
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<AttentionReceipt | null>(null);
  // The task assistant already existed end to end — component, /api/task-chat,
  // and per-task history in the store — but nothing ever opened it.
  const [helpTask, setHelpTask] = useState<Task | null>(null);
  // The home-screen shortcut (/?capture=1, app/manifest.ts) opens Today listening.
  const [listenOnOpen, setListenOnOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture") !== "1") return;
    setListenOnOpen(true);
    window.history.replaceState(null, "", "/");
  }, []);
  const receiptSeq = useRef(0);
  const { sets: questionSets, reload: reloadQuestions } = useQuestionSets();
  const questionTaskIds = useMemo(() => new Set(questionSets.map((q) => q.taskId)), [questionSets]);

  // "Starts in 40 min" and "missed earlier today" drift, so keep the clock live.
  useEffect(() => {
    setNow(wallClockNow(tz));
    const id = window.setInterval(() => setNow(wallClockNow(tz)), 30_000);
    return () => window.clearInterval(id);
  }, [tz]);

  const displayName = state?.user.displayName?.trim() ?? "";
  useEffect(() => {
    setGreeting(displayName ? getGreeting(displayName, localNow(tz).hour) : greetingFor(localNow(tz).hour));
  }, [displayName, tz]);

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
  const colorForTask = useCallback((task: Task) => taskColor(task, plans ?? []), [plans]);

  // The onboarding School block holds the student's school hours for the
  // scheduler and the week insights below; it is not a to-do, so it never
  // shows as a row.
  const doable = useMemo(() => tasks.filter((t) => !isOnboardingSchoolTask(t)), [tasks]);
  const urgency = useMemo(() => getUrgency(doable, now), [now, doable]);
  const attentionIds = useMemo(() => new Set(urgency.items.map((i) => i.task.id)), [urgency]);
  const insight = useMemo(() => getSchedulePulse(tasks, now), [now, tasks]);

  const todaysTasks = useMemo(
    () => doable.filter((t) => t.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [doable, today]
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

  // Onboarding answers only reorder and add; with none, this is DEFAULT_HOME.
  const user = state?.user;
  const prefs = useMemo(() => prefsOf(user), [user]);
  const startingIntent = prefs.startingIntent;
  // The Canvas nudge is for students who went through the new onboarding;
  // the starting point takes the slot while it's there.
  const showCanvasCard = Boolean(user?.email && prefs.helpFocus && !startingIntent);
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
          title={greeting || "Today"}
          description={
            <span className="today-date-line">
              {dateLabel}
              {trackableToday.length > 0 && <span>{completedToday} of {trackableToday.length} complete</span>}
            </span>
          }
        />
      </m.div>

      {/* Adding is the heart of Tangent, so it leads the page. */}
      <m.div variants={riseIn} className="today-add">
        <AddFlow key={listenOnOpen ? "listen" : "type"} variant="hero" listenOnOpen={listenOnOpen} />
      </m.div>

      <SetupNudge />

      <QuestionsInbox sets={questionSets} onChanged={() => { void reloadQuestions(); void refresh(); }} />

      {error && <p className="today-inline-error" role="status">Your schedule could not refresh. Showing the latest available view.</p>}

      <TodayCard
        urgency={urgency}
        todays={dayline}
        today={today}
        nextTask={nextTask}
        questionTaskIds={questionTaskIds}
        colorForTask={colorForTask}
        busyTaskId={busyTaskId}
        receipt={receipt}
        onToggle={(task) => void setCompleted(task, !task.completed)}
        onCompleteUrgent={completeFromAttention}
        onTomorrow={moveToTomorrow}
        onOpen={(task) => openTask(task.id)}
        onHelp={setHelpTask}
        onSeeAll={() => router.push(`/calendar?date=${today}`)}
      />

      <WeekStrip tasks={tasks} now={now} insight={insight} />

      {startingIntent ? (
        <StartingIntentCard intent={startingIntent} onCleared={() => void refresh()} />
      ) : (
        showCanvasCard && user && <CanvasCard email={user.email} />
      )}

      {helpTask && <TaskChatModal task={helpTask} onClose={() => setHelpTask(null)} />}

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
