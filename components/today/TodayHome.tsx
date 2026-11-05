"use client";

// Home. One input, one small slider, then the day in three sections, so a
// student opening the app knows in three seconds what they must do today.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as m from "motion/react-m";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import ActionReceipt from "@/components/ActionReceipt";
import AddFlow, { type AddDestination } from "@/components/add/AddFlow";
import FreshStart from "@/components/dashboard/FreshStart";
import { CanvasCard, StartingIntentCard } from "@/components/dashboard/HomeCards";
import QuestionsInbox from "@/components/dashboard/QuestionsInbox";
import "@/components/dashboard/today-home.css";
import { useTaskFilter } from "@/components/TaskFilterChips";
import { useQuestionSets } from "@/hooks/useQuestionSets";
import { useGrillQueue } from "@/hooks/useGrillQueue";
import { withoutClearedCanvas } from "@/lib/canvas-clear";
import { toYMD } from "@/lib/dates";
import { getGreeting } from "@/lib/greetings";
import { todayQueue } from "@/lib/grill-queue";
import { riseIn, staggerChildren } from "@/lib/motion";
import { prefsOf } from "@/lib/personalize";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import { NO_TIME_LABEL, applyTaskFilter, type TaskFilter } from "@/lib/task-filters";
import { localNow, wallClockNow } from "@/lib/time";
import { readReplanDay, readSetAside, writeReplanDay, writeSetAside } from "@/lib/today-local";
import { glanceLine, groupTodayTasks } from "@/lib/today-sections";
import { MAX_AUTO_MOVES, canMoveStep, freshStartSteps, missedSteps, type SmallerStep } from "@/lib/today-steps";
import { tracksCompletion } from "@/lib/urgency";
import type { ActionRecord, Task } from "@/lib/types";
import TodayFilter from "./TodayFilter";
import TodayRow from "./TodayRow";
import TodaySections from "./TodaySections";
import TodaySlider from "./TodaySlider";
import { useSetupLeft } from "./useSetupLeft";
import "./today.css";

type Override = Partial<Pick<Task, "completed" | "date" | "time" | "overdueDismissedAt">>;
type Receipt = { id: number; label: string; onUndo?: () => void };

const RECEIPT_MS = 6000;
const TODAY_AS_USUAL: TaskFilter = { day: "today", time: "any" };

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning.";
  if (hour >= 12 && hour < 17) return "Good afternoon.";
  if (hour >= 17 && hour < 21) return "Good evening.";
  return "Still going?";
}

function shortDay(ymd: string, today: string): string {
  if (ymd === today) return "today";
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.ok === false) throw new Error(String(data.error ?? "Request failed"));
  return data;
}

export default function TodayHome() {
  const { state, loading, error, refresh } = useAppState();
  const tz = useUserTimezone();
  // Two clocks: the sections read a real instant and convert for themselves;
  // the Phase 1 helpers read a Date holding the student's wall-clock time.
  const [instant, setInstant] = useState(() => new Date());
  const [now, setNow] = useState(() => wallClockNow(tz));
  const today = toYMD(now);
  useEffect(() => {
    const tick = () => {
      setInstant(new Date());
      setNow(wallClockNow(tz));
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [tz]);

  const { sets: questionSets, reload: reloadQuestions } = useQuestionSets();
  const { items: grillItems, reload: reloadGrill } = useGrillQueue();
  const { left: setupLeft, hide: hideSetup } = useSetupLeft();
  const questionTaskIds = useMemo(() => new Set(questionSets.map((q) => q.taskId)), [questionSets]);

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [greeting, setGreeting] = useState("");
  const [destination, setDestination] = useState<AddDestination | null>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const receiptSeq = useRef(0);

  useEffect(() => {
    if (!receipt) return;
    const timer = window.setTimeout(() => setReceipt(null), RECEIPT_MS);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  // The bell's "Answer" lands here as /#questions.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === "#questions") setQuestionsOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const loadRecentActions = useCallback(async () => {
    try {
      const res = await fetch("/api/actions", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; actions?: ActionRecord[] };
      if (data.ok && data.actions) setRecentActions(data.actions.slice(0, 3));
    } catch {}
  }, []);
  useEffect(() => {
    void loadRecentActions();
  }, [loadRecentActions]);

  const serverTasks = useMemo(() => state?.tasks ?? [], [state]);
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

  const tasks = useMemo(() => serverTasks.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t)), [overrides, serverTasks]);
  const plans = useMemo(() => state?.plans ?? [], [state]);

  const grillToday = useMemo(
    () => todayQueue(grillItems, today, (at) => new Date(at).toLocaleDateString("en-CA", { timeZone: tz })),
    [grillItems, today, tz]
  );
  const questionCount = questionSets.reduce((n, s) => n + s.questions.length, 0) + grillToday.length;

  // School blocks hold the student's hours for the scheduler; they aren't
  // to-dos. Canvas work long past due counts as handled (lib/canvas-clear).
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
  const groups = useMemo(() => groupTodayTasks(onToday, instant, tz), [instant, onToday, tz]);

  const [filter, setFilter] = useTaskFilter("today", TODAY_AS_USUAL);
  const filterActive = filter.day !== "today" || filter.time !== "any";
  const filtered = useMemo(() => {
    const open = doable
      .filter((t) => !t.completed && (!t.date || t.date >= today || tracksCompletion(t)))
      .sort((a, b) => (!a.date !== !b.date ? (a.date ? -1 : 1) : a.date.localeCompare(b.date) || a.time.localeCompare(b.time)));
    return applyTaskFilter(open, (t) => t, filter, today);
  }, [doable, filter, today]);

  const displayName = state?.user.displayName?.trim() ?? "";
  const leftToday = groups.mustDo.length + groups.todaysPlan.length;
  const doneToday = useMemo(() => tasks.filter((t) => t.date === today && t.completed && !isOnboardingSchoolTask(t)).length, [tasks, today]);
  useEffect(() => {
    const hour = localNow(tz).hour;
    setGreeting(displayName ? getGreeting(displayName, hour, { left: leftToday, urgent: groups.mustDo.length, done: doneToday }) : greetingFor(hour));
  }, [displayName, tz, leftToday, doneToday, groups.mustDo.length]);

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

  const setCompleted = (task: Task, completed: boolean) =>
    withOverride(task, { completed }, async () => {
      await postJson("/api/tasks", { action: "update_task", id: task.id, completed });
    });

  const onDone = (task: Task) => {
    void setCompleted(task, true).then((ok) =>
      ok ? showReceipt(`Completed “${task.title}”`, () => void setCompleted(task, false)) : showReceipt("That didn't save. Try again.")
    );
  };

  const setAsideForToday = (task: Task) => {
    updateSetAside((ids) => ids.add(task.id));
    showReceipt(`Set “${task.title}” aside for today`, () => updateSetAside((ids) => ids.delete(task.id)));
  };

  const onNotToday = (task: Task) => {
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
  };

  const onSplit = async (task: Task, pieces: SmallerStep[]) => {
    let result: Record<string, unknown> = {};
    const ok = await withOverride(task, {}, async () => {
      result = await postJson("/api/today", { action: "split_apply", taskId: task.id, steps: pieces });
    });
    if (!ok) {
      showReceipt("That didn't save. Try again.");
      return false;
    }
    const kept = result.keptOriginal === true;
    if (kept) updateSetAside((ids) => ids.add(task.id));
    const { actionId } = result;
    showReceipt(`Split “${task.title}” into ${pieces.length} steps`, () => {
      if (kept) updateSetAside((ids) => ids.delete(task.id));
      if (typeof actionId === "string") void undoAction(actionId);
    });
    return true;
  };

  // Hides the row, without completing or deleting it. Before the migration runs
  // the dismissal can't be stored, so it lasts for this visit.
  const onDismiss = (task: Task) => {
    let result: Record<string, unknown> = {};
    void withOverride(task, { overdueDismissedAt: new Date().toISOString() }, async () => {
      result = await postJson("/api/tasks", { action: "dismiss_overdue", id: task.id });
    }).then((ok) => {
      if (!ok) return showReceipt("That didn't save. Try again.");
      const { actionId } = result;
      showReceipt(`Dismissed “${task.title}”`, () => {
        setOverrides((o) => {
          const next = { ...o };
          delete next[task.id];
          return next;
        });
        if (typeof actionId === "string") void undoAction(actionId);
      });
    });
  };

  const clearedSteps = useMemo(() => freshStartSteps(doable, { date: today, minutes: now.getHours() * 60 + now.getMinutes() }), [doable, now, today]);
  const missedCount = useMemo(() => missedSteps(doable, today).length, [doable, today]);
  const replanDay = useRef<string | null>(null);

  const freshStart = async () => {
    try {
      const { moved, actionId } = await postJson("/api/today", { action: "fresh_start" });
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
  };

  // Once a day, small misses quietly move ahead, with an Undo.
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
        replanDay.current = null;
      }
    })();
  }, [loaded, loadRecentActions, missedCount, refresh, showReceipt, today, undoAction]);

  const user = state?.user;
  const prefs = useMemo(() => prefsOf(user), [user]);
  const startingIntent = prefs.startingIntent;
  const showCanvasCard = Boolean(user?.email && prefs.helpFocus && !startingIntent);
  const glance = useMemo(() => glanceLine(groups, instant, tz), [groups, instant, tz]);

  const rowActions = { onDone, onNotToday, onSplit, onDismiss };

  if (loading && !state) {
    return (
      <div className="today-page today-v2" aria-busy="true">
        <div className="today-loading-heading" />
        <div className="today-loading-attention" />
        <div className="today-loading-rows"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <m.div className="today-page today-v2" variants={staggerChildren} initial="hidden" animate="show">
      <m.header variants={riseIn} className="today-head">
        <h1 className="today-greeting">{greeting || " "}</h1>
        <TodayFilter filter={filter} onChange={setFilter} active={filterActive} />
      </m.header>

      {error && <p className="today-inline-error" role="status">Your schedule could not refresh. Showing the latest available view.</p>}

      <m.div variants={riseIn} className="today-add" data-primary-composer>
        <AddFlow
          variant="hero"
          placeholder="Type or say anything…"
          hideDest
          destination={destination}
          onDestinationClear={() => setDestination(null)}
          onDestinationUsed={() => setDestination(null)}
        />
      </m.div>

      <m.div variants={riseIn}>
        <TodaySlider
          glance={glance}
          onGlance={() => {
            const target = document.getElementById("must-do");
            target?.scrollIntoView({ block: "start" });
            target?.focus({ preventScroll: true });
          }}
          plans={plans}
          destination={destination}
          onDestination={setDestination}
          questionCount={questionCount}
          onAnswer={() => setQuestionsOpen(true)}
          setupLeft={setupLeft}
          onHideSetup={hideSetup}
        />
      </m.div>

      {questionsOpen && (
        <QuestionsInbox
          defaultOpen
          onClose={() => setQuestionsOpen(false)}
          sets={questionSets}
          grill={grillToday}
          onChanged={() => {
            void reloadQuestions();
            void reloadGrill();
            void refresh();
          }}
        />
      )}

      <m.div variants={riseIn}>
        {filterActive ? (
          <section className="today-section" aria-label="Filtered to-do">
            {filtered.main.length + filtered.noTime.length === 0 ? (
              <p className="today-section-empty">Nothing here. Try another filter.</p>
            ) : (
              <div className="today-rows">
                {[...filtered.main, ...filtered.noTime].map((task, i) => (
                  <div key={task.id} className="today-rows-item">
                    {i === filtered.main.length && <p className="task-filter-group">{NO_TIME_LABEL}</p>}
                    <TodayRow
                      task={task}
                      plans={plans}
                      now={instant}
                      today={today}
                      timezone={tz}
                      busy={busyTaskId === task.id}
                      hasQuestions={questionTaskIds.has(task.id)}
                      {...rowActions}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <TodaySections
            groups={groups}
            plans={plans}
            now={instant}
            today={today}
            timezone={tz}
            busyTaskId={busyTaskId}
            questionTaskIds={questionTaskIds}
            planFooter={<FreshStart count={clearedSteps.length} backlog={missedCount > MAX_AUTO_MOVES} onConfirm={freshStart} />}
            {...rowActions}
          />
        )}
      </m.div>

      {startingIntent && (
        <m.div variants={riseIn}>
          <StartingIntentCard intent={startingIntent} onCleared={() => void refresh()} />
        </m.div>
      )}
      {showCanvasCard && user?.email && (
        <m.div variants={riseIn}>
          <CanvasCard email={user.email} />
        </m.div>
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

      {receipt && (
        <div key={receipt.id} className="today-receipt" role="status">
          <span>{receipt.label}</span>
          {receipt.onUndo && <button type="button" onClick={receipt.onUndo}>Undo</button>}
        </div>
      )}
    </m.div>
  );
}
