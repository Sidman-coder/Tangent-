"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { localNow, wallClockNow } from "@/lib/time";
import ActionReceipt from "@/components/ActionReceipt";
import { openTask } from "@/components/TaskDetail";
import { askAboutHref } from "@/lib/ask-handoff";
import TodayCard, { type AttentionReceipt } from "@/components/dashboard/TodayCard";
import { shortDay } from "@/components/dashboard/TodayStep";
import TaskFilterChips, { useTaskFilter } from "@/components/TaskFilterChips";
import TaskRow from "@/components/ui/TaskRow";
import { NO_TIME_LABEL, applyTaskFilter, type TaskFilter } from "@/lib/task-filters";
import WeekStrip from "@/components/dashboard/WeekStrip";
import SetupNudge from "@/components/dashboard/SetupNudge";
import AddFlow from "@/components/add/AddFlow";
import { CanvasCard, StartingIntentCard } from "@/components/dashboard/HomeCards";
import PageHeader from "@/components/ui/PageHeader";
import "@/components/dashboard/today-home.css";
import {
  MAX_AUTO_MOVES,
  type SmallerStep,
  canMoveStep,
  freshStartSteps,
  missedSteps,
  pickTodaySteps,
} from "@/lib/today-steps";
import { readReplanDay, readSetAside, writeReplanDay, writeSetAside } from "@/lib/today-local";
import type { ActionRecord, Task } from "@/lib/types";
import { toYMD } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";
import { riseIn, staggerChildren } from "@/lib/motion";
import { prefsOf } from "@/lib/personalize";
import { getSchedulePulse } from "@/lib/schedule-insights";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import QuestionsInbox from "@/components/dashboard/QuestionsInbox";
import { useQuestionSets } from "@/hooks/useQuestionSets";
import { useGrillQueue } from "@/hooks/useGrillQueue";
import { todayQueue } from "@/lib/grill-queue";
import { taskColor } from "@/lib/task-colors";
import { getUrgency, tracksCompletion } from "@/lib/urgency";
import { withoutClearedCanvas } from "@/lib/canvas-clear";

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

const TODAY_AS_USUAL: TaskFilter = { day: "today", time: "any" };

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
  const receiptSeq = useRef(0);
  const { sets: questionSets, reload: reloadQuestions } = useQuestionSets();
  const { items: grillItems, reload: reloadGrill } = useGrillQueue();
  const questionTaskIds = useMemo(() => new Set(questionSets.map((q) => q.taskId)), [questionSets]);

  // "Starts in 40 min" and "missed earlier today" drift, so keep the clock live.
  useEffect(() => {
    setNow(wallClockNow(tz));
    const id = window.setInterval(() => setNow(wallClockNow(tz)), 30_000);
    return () => window.clearInterval(id);
  }, [tz]);

  const displayName = state?.user.displayName?.trim() ?? "";


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
  const grillToday = useMemo(
    () => todayQueue(grillItems, today, (at) => new Date(at).toLocaleDateString("en-CA", { timeZone: tz })),
    [grillItems, today, tz]
  );
  const colorForTask = useCallback((task: Task) => taskColor(task), []);

  // The onboarding School block holds the student's school hours for the
  // scheduler and the week insights below; it is not a to-do, so it never
  // shows as a row. Canvas work long past due counts as handled (lib/canvas-clear).
  const doable = useMemo(() => withoutClearedCanvas(tasks.filter((t) => !isOnboardingSchoolTask(t)), today), [tasks, today]);
  // Set aside with Not today: gone from today's lists, still on the calendar.
  const [setAside, setSetAside] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => setSetAside(readSetAside(today)), [today]);
  const updateSetAside = useCallback(
    (change: (ids: Set<string>) => void) =>
      setSetAside((current) => {
        const next = new Set(current);
        change(next);
        writeSetAside(today, next);
        return next;
      }),
    [today]
  );
  const onToday = useMemo(() => doable.filter((t) => !setAside.has(t.id)), [doable, setAside]);
  const steps = useMemo(() => pickTodaySteps(onToday, today), [onToday, today]);
  const urgency = useMemo(() => getUrgency(onToday, now), [now, onToday]);
  const attentionIds = useMemo(() => new Set(urgency.items.map((i) => i.task.id)), [urgency]);
  // Handled Canvas work stays out of the week strip and its pulse too.
  const weekTasks = useMemo(() => withoutClearedCanvas(tasks, today), [tasks, today]);
  const insight = useMemo(() => getSchedulePulse(weekTasks, now), [now, weekTasks]);

  // The chips: today as usual until the student narrows it or looks further out.
  // Past events that were never "done" aren't overdue work, so they stay out.
  const [filter, setFilter] = useTaskFilter("today", TODAY_AS_USUAL);
  const filtered = useMemo(() => {
    const open = doable
      .filter((t) => !t.completed && (!t.date || t.date >= today || tracksCompletion(t)))
      .sort((a, b) => (!a.date !== !b.date ? (a.date ? -1 : 1) : a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    return applyTaskFilter(open, (t) => t, filter, today);
  }, [doable, filter, today]);

  const todaysTasks = useMemo(
    () => onToday.filter((t) => t.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [onToday, today]
  );
  // Today's list shows what the attention section doesn't, open work first.
  const dayline = useMemo(
    () =>
      todaysTasks
        .filter((t) => !attentionIds.has(t.id))
        .sort((a, b) => Number(a.completed) - Number(b.completed) || a.time.localeCompare(b.time)),
    [attentionIds, todaysTasks]
  );

  // The greeting reads the day, so it never praises a day that still needs you.
  const leftToday = dayline.filter((t) => !t.completed && tracksCompletion(t)).length + urgency.items.length;
  const doneToday = todaysTasks.filter((t) => t.completed && tracksCompletion(t)).length;
  useEffect(() => {
    const hour = localNow(tz).hour;
    setGreeting(
      displayName
        ? getGreeting(displayName, hour, { left: leftToday, urgent: urgency.items.length, done: doneToday })
        : greetingFor(hour)
    );
  }, [displayName, tz, leftToday, doneToday, urgency.items.length]);

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

  const showReceipt = useCallback((label: string, onUndo?: () => void) => {
    setReceipt({
      id: ++receiptSeq.current,
      label,
      onUndo: onUndo && (() => {
        setReceipt(null);
        onUndo();
      }),
    });
  }, []);

  const undoAction = useCallback(
    async (id: string) => {
      try {
        await postJson("/api/actions", { id });
        await refresh();
        void loadRecentActions();
      } catch {
        showReceipt("That couldn't be undone. Try again from Recent activity.");
      }
    },
    [loadRecentActions, refresh, showReceipt]
  );

  // A date that's a fact (Canvas, a due date, a repeating task) stays as it is:
  // the step just leaves today's lists until tomorrow.
  const setAsideForToday = useCallback(
    (task: Task) => {
      updateSetAside((ids) => ids.add(task.id));
      showReceipt(`Set “${task.title}” aside for today`, () => updateSetAside((ids) => ids.delete(task.id)));
    },
    [showReceipt, updateSetAside]
  );

  const notToday = useCallback(
    (task: Task) => {
      if (!canMoveStep(task)) return setAsideForToday(task);
      let result: Record<string, unknown> = {};
      void withOverride(task, {}, async () => {
        result = await postJson("/api/today", { action: "not_today", taskId: task.id });
      }).then((ok) => {
        if (!ok) return showReceipt("That didn't move. Try again.");
        const { actionId, date } = result;
        if (typeof actionId !== "string") return setAsideForToday(task);
        const day = typeof date === "string" ? shortDay(date, today) : "the days ahead";
        showReceipt(`Moved “${task.title}” to ${day}`, () => void undoAction(actionId));
      });
    },
    [setAsideForToday, showReceipt, today, undoAction, withOverride]
  );

  const splitStep = useCallback(
    async (task: Task, pieces: SmallerStep[]) => {
      let result: Record<string, unknown> = {};
      const ok = await withOverride(task, {}, async () => {
        result = await postJson("/api/today", { action: "split_apply", taskId: task.id, steps: pieces });
      });
      if (!ok) {
        showReceipt("That didn't save. Try again.");
        return false;
      }
      // A kept original (a real deadline) would otherwise sit beside its pieces.
      const kept = result.keptOriginal === true;
      if (kept) updateSetAside((ids) => ids.add(task.id));
      const { actionId } = result;
      showReceipt(`Split “${task.title}” into ${pieces.length} steps`, () => {
        if (kept) updateSetAside((ids) => ids.delete(task.id));
        if (typeof actionId === "string") void undoAction(actionId);
      });
      return true;
    },
    [showReceipt, undoAction, updateSetAside, withOverride]
  );

  const clearedSteps = useMemo(
    () => freshStartSteps(doable, { date: today, minutes: now.getHours() * 60 + now.getMinutes() }),
    [doable, now, today]
  );
  const missedCount = useMemo(() => missedSteps(doable, today).length, [doable, today]);

  const freshStart = useCallback(async () => {
    try {
      const { moved, actionId } = await postJson("/api/today", { action: "fresh_start" });
      // Undo shouldn't be followed by the automatic re-plan moving it all again.
      writeReplanDay(today);
      replanDay.current = today;
      await refresh();
      void loadRecentActions();
      const count = Number(moved) || 0;
      if (count > 0 && typeof actionId === "string") {
        showReceipt(`Fresh start: ${count} step${count === 1 ? "" : "s"} moved ahead`, () => void undoAction(actionId));
      }
      return true;
    } catch {
      showReceipt("That didn't go through. Nothing moved. Try again.");
      return false;
    }
  }, [loadRecentActions, refresh, showReceipt, today, undoAction]);

  // The automatic re-plan on a miss: once a day, when Today opens, with Undo.
  // Once only, so undoing it isn't undone by the next page load. No AI here,
  // and a backlog moves nothing: Fresh start is offered instead.
  const replanDay = useRef<string | null>(null);
  const loaded = Boolean(state);
  useEffect(() => {
    if (!loaded || replanDay.current === today) return;
    replanDay.current = today;
    if (readReplanDay() === today || missedCount === 0 || missedCount > MAX_AUTO_MOVES) return;
    void (async () => {
      try {
        const { moved, actionId } = await postJson("/api/today", { action: "replan" });
        writeReplanDay(today);
        const count = Number(moved) || 0;
        if (count === 0 || typeof actionId !== "string") return;
        await refresh();
        void loadRecentActions();
        showReceipt(`Re-planned ${count} step${count === 1 ? "" : "s"} from an earlier day`, () => void undoAction(actionId));
      } catch {
        // It tries again the next time Today opens.
        replanDay.current = null;
      }
    })();
  }, [loaded, loadRecentActions, missedCount, refresh, showReceipt, today, undoAction]);

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
          description={<span className="today-date-line">{dateLabel}</span>}
          actions={<SetupNudge />}
        />
      </m.div>

      {/* Adding is the heart of Tangent, so it leads the page. Hick's Law:
          this is the one primary action here; AppShell hides the floating mic
          while it's on screen so there's never two mics at once. */}
      <m.div variants={riseIn} className="today-add" data-primary-composer>
        <AddFlow variant="hero" />
      </m.div>

      <QuestionsInbox sets={questionSets} grill={grillToday} onChanged={() => { void reloadQuestions(); void reloadGrill(); void refresh(); }} />

      {error && <p className="today-inline-error" role="status">Your schedule could not refresh. Showing the latest available view.</p>}

      <TaskFilterChips filter={filter} onChange={setFilter} />

      {filter.day !== "today" || filter.time !== "any" ? (
        <section className="today-card" aria-label="Filtered to-do">
          {filtered.main.length + filtered.noTime.length === 0 ? (
            <p className="task-filter-empty">Nothing here. Try another filter.</p>
          ) : (
            <div className="today-card-list">
              {[...filtered.main, ...filtered.noTime].flatMap((task, i) => [
                ...(i === filtered.main.length ? [<p key="no-time" className="task-filter-group">{NO_TIME_LABEL}</p>] : []),
                <div key={task.id} className="today-card-row">
                  <TaskRow
                    task={task}
                    showDate={task.date !== today}
                    hasQuestions={questionTaskIds.has(task.id)}
                    kindColor={colorForTask(task)}
                    onComplete={tracksCompletion(task) ? () => void setCompleted(task, true) : undefined}
                    onOpen={() => openTask(task.id)}
                  />
                </div>,
              ])}
            </div>
          )}
        </section>
      ) : (
      <TodayCard
        urgency={urgency}
        steps={steps}
        todays={dayline}
        today={today}
        nextTask={nextTask}
        questionTaskIds={questionTaskIds}
        colorForTask={colorForTask}
        busyTaskId={busyTaskId}
        receipt={receipt}
        onToggle={(task) => void setCompleted(task, !task.completed)}
        onCompleteUrgent={completeFromAttention}
        onNotToday={notToday}
        onSplit={splitStep}
        onOpen={(task) => openTask(task.id)}
        onHelp={(task) => router.push(askAboutHref({ kind: "task", id: task.id }))}
        onSeeAll={() => router.push(`/calendar?date=${today}`)}
        freshStartCount={clearedSteps.length}
        backlog={missedCount > MAX_AUTO_MOVES}
        onFreshStart={freshStart}
      />
      )}

      <WeekStrip tasks={weekTasks} now={now} insight={insight} />

      {startingIntent ? (
        <StartingIntentCard intent={startingIntent} onCleared={() => void refresh()} />
      ) : (
        showCanvasCard && user && <CanvasCard email={user.email} />
      )}

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
