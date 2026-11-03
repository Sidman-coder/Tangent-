"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { m, useReducedMotion } from "motion/react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { wallClockNow } from "@/lib/time";
import AddTaskModal from "@/components/AddTaskModal";
import ActionReceipt from "@/components/ActionReceipt";
import ClarifyCard, { type ClarifyAnswer, type ClarifyQuestion } from "@/components/console/ClarifyCard";
import PreviewCard from "@/components/PreviewCard";
import type { ChangeSet } from "@/lib/pipeline/changeset";
import type { PreviewPayload } from "@/lib/pipeline/draft";
import { PENDING_QUESTION_ID, type PendingQuestion } from "@/lib/pending-question";
import { openTask } from "@/components/TaskDetail";
import Button from "@/components/ui/Button";
import SidePeek from "@/components/ui/SidePeek";
import { handleResourceClick } from "@/lib/task-utils";
import { toYMD, formatTime12 } from "@/lib/dates";
import { isCanvasCleared } from "@/lib/canvas-clear";
import { CATEGORY_COLOR, CATEGORY_LABEL, TASK_GROUPS, groupByCategory, taskColor, taskGroup, type TaskGroup } from "@/lib/task-colors";
import { isOnboardingSchoolTask } from "@/lib/school-block";
import { baseTitle, useShortTitles } from "@/lib/short-titles";
import "./calendar.css";
import { initialCalendarView, prefsOf } from "@/lib/personalize";
import { announceUndo, openRecentChanges } from "@/lib/undo-events";
import type { Plan, Task } from "@/lib/types";
import { X, Check, ChevronLeft, ChevronRight, Plus, PlusCircle, Repeat, Pencil, Undo2 } from "lucide-react";
import WeekView from "@/components/calendar/WeekView";
import AgendaView from "@/components/calendar/AgendaView";
import TaskTip from "@/components/calendar/TaskTip";
import TaskTitle from "@/components/ui/TaskTitle";

type CalView = "week" | "month" | "agenda";
const VIEWS: { id: CalView; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "agenda", label: "Agenda" },
];
const VIEW_KEY = "tangent-cal-view";
const AGENDA_DAYS = 21;

function startOfWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Date[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push(new Date(year, monthIndex, -startPad + i + 1));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, monthIndex, d));
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return cells;
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

type RecurDeleteTarget = { taskId: string; parentId: string; title: string };
type RecurEditTarget = { taskId: string; parentId: string; task: Task };


/** One day-chat message, with the cards a reply can carry (master fix B3). */
type DayChatMessage = {
  role: "user" | "assistant";
  content: string;
  questions?: ClarifyQuestion[];
  pendingQuestion?: PendingQuestion | null;
  /** The ask a card's answers run (its context included). */
  request?: string;
  draft?: { changeSet: ChangeSet; preview: PreviewPayload };
  actionId?: string;
  pendingConfirm?: { id: string; message: string };
};

export default function CalendarPage() {
  const { state, refresh } = useAppState();
  const now = wallClockNow(useUserTimezone());
  const todayYmd = toYMD(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [group, setGroup] = useState<TaskGroup | "all">("all");
  const [view, setView] = useState<CalView>("month");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [agendaStart, setAgendaStart] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Clicking one event opens just that event; clicking the date opens the day.
  const [removed, setRemoved] = useState<{ actionId: string; title: string; label?: string } | null>(null);
  /** A dragged block stays where it was dropped while the save is in flight. */
  const [moving, setMoving] = useState<{ id: string; date: string; time: string } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  /** Master fix Phase 5: Remove on a busy day picks tasks with the B6 chips;
   *  this is the task that was clicked (chosen to start with). */
  const [removePick, setRemovePick] = useState<string | null>(null);
  /** Month cells show this many tasks before "+N more" (at least 3; 4 on desktop). */
  const [perCell, setPerCell] = useState(3);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState(todayYmd);
  const [addModalTime, setAddModalTime] = useState<string | undefined>(undefined);
  const [duplicateToast, setDuplicateToast] = useState(false);
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState<RecurDeleteTarget | null>(null);
  const [recurEditTarget, setRecurEditTarget] = useState<RecurEditTarget | null>(null);
  const [recurDeleting, setRecurDeleting] = useState(false);
  const [dayChatMessages, setDayChatMessages] = useState<DayChatMessage[]>([]);
  const [dayChatInput, setDayChatInput] = useState("");
  const [dayChatBusy, setDayChatBusy] = useState(false);

  const plans: Plan[] = state?.plans ?? [];

  const getPlan = useCallback((planId: string | null | undefined): Plan | null => {
    if (!planId) return null;
    return plans.find((p) => p.id === planId) ?? null;
  }, [plans]);

  const getTaskCategoryColor = useCallback(
    // Handled Canvas work (lib/canvas-clear) stays to look back on, in grey.
    (t: Task): string => (isCanvasCleared(t, todayYmd) ? "var(--cat-other)" : taskColor(t)),
    [todayYmd]
  );

  const tasksForDay = useCallback((ymd: string): Task[] => {
    // The onboarding School block stores the student's school hours for the
    // scheduler; it is not something to do, so it is never drawn.
    let tasks = (state?.tasks ?? []).filter((t) => !isOnboardingSchoolTask(t));
    if (group !== "all") tasks = tasks.filter((t) => taskGroup(t) === group);
    if (planFilter) tasks = tasks.filter((t) => t.planId === planFilter);
    if (moving) tasks = tasks.map((t) => (t.id === moving.id ? { ...t, date: moving.date, time: moving.time } : t));
    return tasks.filter((t) => t.date === ymd);
  }, [state, group, planFilter, moving]);

  // Same record as any reschedule, so the Undo toast and Recent changes revert it.
  const moveTask = useCallback(async (t: Task, date: string, time: string) => {
    setMoveError(null);
    setMoving({ id: t.id, date, time });
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: t.id, suggestedDate: date, suggestedTime: time }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; actionId?: string };
      if (!res.ok || !data.ok) throw new Error("move failed");
      await refresh();
      if (data.actionId) {
        const day = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
        announceUndo({ actionId: data.actionId, label: `Moved “${t.title}” to ${day} ${formatTime12(time)}` });
      }
    } catch {
      setMoveError(`Couldn't move “${t.title}”. It's back where it was.`);
    } finally {
      setMoving(null);
    }
  }, [refresh]);

  const wholeDayTasks = selectedDay
    ? tasksForDay(selectedDay).slice().sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const selectedDayTasks = wholeDayTasks;

  // Remember the chosen view; first visit gets the week grid on wide screens
  // and the agenda list on phones, where seven columns can't breathe. A
  // student who asked to see "This week" first gets the week grid until they
  // pick a view themselves (lib/personalize.ts initialCalendarView).
  const profileLoaded = state !== null;
  const dayView = state?.user.dayView ?? null;
  useEffect(() => {
    if (!profileLoaded) return;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(VIEW_KEY); } catch { /* storage blocked */ }
    const savedView = saved === "week" || saved === "month" || saved === "agenda" ? saved : null;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    setView(initialCalendarView(prefsOf({ dayView }), savedView, narrow));
  }, [profileLoaded, dayView]);

  const chooseView = (next: CalView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked */ }
  };

  // Reset the day-chat thread whenever a different day is opened
  useEffect(() => {
    setDayChatMessages([]);
    setDayChatInput("");
    setRemovePick(null);
  }, [selectedDay]);

  // Master fix Phase 5: as many tasks per month cell as the viewport's row
  // height fits, never fewer than 3 (4 on desktop). From the window size, not
  // the cells, so showing more never makes the cells grow into showing more.
  useEffect(() => {
    const fit = () => {
      const floor = window.matchMedia("(min-width: 1024px)").matches ? 4 : 3;
      const rowHeight = (window.innerHeight - 190) / 6; // toolbar, weekday row; six week rows
      const rows = Math.floor((rowHeight - 58) / 22); // date number and "+N more"; one task line
      setPerCell(Math.min(8, Math.max(floor, rows)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Master fix B3: the day chat shows Tangent's questions and previews as the
  // same cards as the AI page, and answers them the same way (app/(app)/ai).
  // `followUp`: a card's answers; `request` is the ask they answer.
  const sendDayChat = useCallback(async (followUp?: { shown: string; request?: string; answers?: ClarifyAnswer[]; tapped?: boolean }) => {
    const text = (followUp?.shown ?? dayChatInput).trim();
    if (!text || !selectedDay || dayChatBusy) return;
    setDayChatBusy(true);
    if (!followUp) setDayChatInput("");

    const dateLabel = new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const taskSummary = selectedDayTasks.length
      ? selectedDayTasks.map((t) => `- ${t.time} ${t.title}${t.completed ? " (done)" : ""}${t.notes ? `: ${t.notes}` : ""}`).join("\n")
      : "No tasks scheduled.";
    const contextualMessage = `Context: the user is looking at ${dateLabel}. Tasks for that day:\n${taskSummary}\n\nQuestion: ${text}`;

    // A question Tangent is waiting on (the last reply's, until it expires).
    const last = dayChatMessages[dayChatMessages.length - 1];
    const waiting = last?.pendingQuestion && Date.parse(last.pendingQuestion.expiresAt) > Date.now() ? last.pendingQuestion : null;
    const asked = waiting ? text : followUp?.request ?? contextualMessage;
    const history = dayChatMessages.map((m) => ({ role: m.role, content: m.content }));
    // Answered or dropped either way: only the newest reply's card stays live.
    setDayChatMessages([...dayChatMessages.map((m) => (m.questions ? { ...m, questions: undefined, pendingQuestion: null } : m)), { role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: asked }],
          mode: "calendar",
          clarify: !followUp?.request,
          pendingQuestion: waiting ?? undefined,
          answers: followUp?.answers ?? (followUp?.tapped && waiting ? [{ id: PENDING_QUESTION_ID, question: "", answer: text }] : undefined),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        action?: string | null;
        actionId?: string;
        questions?: ClarifyQuestion[];
        pendingQuestion?: PendingQuestion | null;
        changeSet?: ChangeSet;
        preview?: PreviewPayload;
        pending?: { id: string; message: string };
      };
      const reply = data.ok ? data.message || data.pending?.message || "Done." : (data.error || "Something went wrong.");
      const draft = data.action === "preview" && data.changeSet && data.preview ? { changeSet: data.changeSet, preview: data.preview } : undefined;
      setDayChatMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply,
          questions: data.questions?.length ? data.questions : undefined,
          pendingQuestion: data.pendingQuestion ?? null,
          request: data.questions?.length ? asked : undefined,
          draft,
          actionId: data.actionId,
          pendingConfirm: data.action === "confirm_required" && data.pending ? data.pending : undefined,
        },
      ]);
      if (data.actionId) await refresh();
    } catch {
      setDayChatMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the assistant." }]);
    } finally {
      setDayChatBusy(false);
    }
  }, [dayChatInput, dayChatBusy, selectedDay, dayChatMessages, selectedDayTasks, refresh]);

  /** A card's answers: a "Which one?" tap is the next message; a plan's
   *  questions run the original ask with them (or "Just do it"). */
  const answerDayChat = useCallback(
    (index: number, answers: ClarifyAnswer[] | null) => {
      const m = dayChatMessages[index];
      if (!m) return;
      if (m.pendingQuestion) return void sendDayChat({ shown: answers?.[0]?.answer ?? "Cancel", tapped: true });
      const shown = answers && answers.length > 0 ? answers.map((a) => a.answer).join(" · ") : "Just do it";
      void sendDayChat({ shown, request: m.request, answers: answers ?? undefined });
    },
    [dayChatMessages, sendDayChat]
  );

  /** The older Confirm/Cancel (flag off, or a very large delete). */
  const confirmDayChat = useCallback(
    async (index: number, id: string, confirm: boolean) => {
      setDayChatMessages((ms) => ms.map((m, i) => (i === index ? { ...m, pendingConfirm: undefined } : m)));
      try {
        const res = await fetch("/api/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, confirm }),
        });
        const data = (await res.json()) as { ok?: boolean; response?: string; error?: string; actionId?: string };
        const reply = !res.ok || !data.ok ? data.error || "Something went wrong." : data.response || (confirm ? "Done." : "Cancelled.");
        setDayChatMessages((ms) => [...ms, { role: "assistant", content: reply, actionId: data.actionId }]);
        if (data.actionId) await refresh();
      } catch {
        setDayChatMessages((ms) => [...ms, { role: "assistant", content: "Something went wrong reaching the assistant." }]);
      }
    },
    [refresh]
  );

  const cells = getMonthGrid(year, month);

  // Which way the last month change went, so the new month slides in from
  // the side you are travelling toward.
  const [monthDir, setMonthDir] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const goToday = () => {
    const here = year * 12 + month; const there = now.getFullYear() * 12 + now.getMonth();
    setMonthDir(Math.sign(there - here)); setYear(now.getFullYear()); setMonth(now.getMonth());
    setWeekStart(startOfWeek(now));
    setAgendaStart(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };
  const step = (dir: -1 | 1) => {
    if (view === "month") { if (dir < 0) prevMonth(); else nextMonth(); return; }
    setMonthDir(dir);
    if (view === "week") setWeekStart((w) => addDays(w, dir * 7));
    else setAgendaStart((a) => addDays(a, dir * AGENDA_DAYS));
  };
  const prevMonth = () => { setMonthDir(-1); if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((mo) => mo - 1); };
  const nextMonth = () => { setMonthDir(1); if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((mo) => mo + 1); };

  const toggleTask = async (id: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task", id }),
    });
    await refresh();
  };

  // Master fix Phase 5: on a day with other tasks, Remove asks which ones with
  // the same multi-select chips as the chat (B6), the clicked one chosen.
  const handleDeleteTask = (t: Task) => {
    if (selectedDay && selectedDayTasks.length > 1) setRemovePick(t.id);
    else removeTask(t);
  };

  /** The tasks the Remove chips name, by label ("All of these" is every one). */
  const removeLabels = (tasks: Task[]) => {
    const seen = new Map<string, number>();
    return tasks.map((t) => {
      const base = t.time && t.time !== "23:59" ? `${t.title} · ${formatTime12(t.time)}` : t.title;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { task: t, label: n > 1 ? `${base} (${n})` : base };
    });
  };

  const removePicked = async (answers: ClarifyAnswer[] | null) => {
    setRemovePick(null);
    const answer = answers?.[0]?.answer ?? "";
    if (!answer) return;
    const labelled = removeLabels(selectedDayTasks);
    const picked = answer === "All of these"
      ? labelled.map((l) => l.task)
      : labelled.filter((l) => `, ${answer}, `.includes(`, ${l.label}, `)).map((l) => l.task);
    if (picked.length === 0) return;
    if (picked.length === 1) return removeTask(picked[0]);
    // One change, one Undo: a recurring task loses just this day's occurrence.
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_tasks", ids: picked.map((t) => t.id) }),
    });
    const data = (await res.json().catch(() => ({}))) as { actionId?: string };
    if (data.actionId) setRemoved({ actionId: data.actionId, title: picked[0].title, label: `Removed ${picked.length} tasks` });
    await refresh();
  };

  const removeTask = (t: Task) => {
    if (t.recurring?.enabled && t.recurring.parentId) {
      setRecurDeleteTarget({ taskId: t.id, parentId: t.recurring.parentId, title: t.title });
    } else {
      void (async () => {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_task", id: t.id }),
        });
        const data = (await res.json().catch(() => ({}))) as { actionId?: string };
        if (data.actionId) setRemoved({ actionId: data.actionId, title: t.title });
        await refresh();
      })();
    }
  };

  const confirmRecurDelete = async (deleteAll: boolean) => {
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
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedDay(null); setRemoved(null); setShowAddModal(false); setRecurDeleteTarget(null); setRecurEditTarget(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openTaskDate = useCallback((ymd: string) => {
    const d = new Date(`${ymd}T00:00:00`);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setWeekStart(startOfWeek(d));
    setSelectedDay(ymd);
  }, []);

  // Cross-page "Open" navigation (e.g. the Today page's focus card or an insight
  // link) lands here with ?date=YYYY-MM-DD, optionally &add=1[&time=HH:MM] to
  // jump straight into adding a task on that date.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      openTaskDate(dateParam);
      if (params.get("add") === "1") {
        setAddModalDate(dateParam);
        setAddModalTime(params.get("time") ?? undefined);
        setShowAddModal(true);
      }
      window.history.replaceState(null, "", "/calendar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const agendaDays = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(agendaStart, i));

  // Concise labels for what's on screen (lib/short-titles.ts): narrow cells
  // get "French PBA: relationships", the day panel keeps the full title.
  const visibleYmds = new Set((view === "week" ? weekDays : cells).map((d) => toYMD(d)));
  const onScreen = (state?.tasks ?? []).filter((t) => visibleYmds.has(t.date));
  const shortLabels = useShortTitles(onScreen);
  const labelFor = (t: Task) => shortLabels[t.id] ?? baseTitle(t);
  // The heading follows the view: the month, or the span a week/agenda covers.
  const headingDate = view === "month" ? new Date(year, month, 1) : view === "week" ? weekStart : agendaStart;
  const headingMonth = headingDate.toLocaleString(undefined, { month: "long" });
  const headingYear = String(headingDate.getFullYear());
  const spanEnd = view === "week" ? weekDays[6] : agendaDays[agendaDays.length - 1];
  const headingSpan = view === "month"
    ? null
    : `${headingDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${spanEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const unitLabel = view === "month" ? "month" : view === "week" ? "week" : "three weeks";
  const openAddAt = (ymd: string, time?: string) => { setAddModalDate(ymd); setAddModalTime(time); setShowAddModal(true); };
  const activePlan = planFilter ? getPlan(planFilter) : null;

  // The island: every calendar control on one floating glass capsule at the
  // bottom centre, so the grid gets the whole page. Portalled to <body>: the
  // page's entrance transform would otherwise make "fixed" relative to it.
  const island = (
      <div className="cal-island lg lg-interactive" role="toolbar" aria-label="Calendar controls">
        <div className="cal-island-group">
              <div className="cal-view-switch" role="tablist" aria-label="Calendar view">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={view === v.id}
                    className={`cal-view-tab${view === v.id ? " is-active" : ""}`}
                    onClick={() => chooseView(v.id)}
                  >
                    {view === v.id && (
                      <m.span layoutId="cal-view-pill" className="cal-view-pill" transition={{ type: "spring", visualDuration: 0.28, bounce: 0 }} />
                    )}
                    <span className="cal-view-label">{v.label}</span>
                  </button>
                ))}
              </div>
              <div className="cal-arrows">
                <button type="button" className="cal-arrow" onClick={() => step(-1)} aria-label={`Previous ${unitLabel}`}>
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button type="button" className="cal-today" onClick={goToday}>Today</button>
                <button type="button" className="cal-arrow" onClick={() => step(1)} aria-label={`Next ${unitLabel}`}>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className="cal-arrow" onClick={openRecentChanges} aria-label="Recent changes" title="Recent changes">
                  <Undo2 size={16} aria-hidden="true" />
                </button>
              </div>
        </div>
          <div className="cal-segment-bar" role="tablist" aria-label="Show">
            {[{ id: "all" as const, label: "All" }, ...TASK_GROUPS].map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={group === g.id}
                className={`cal-segment${group === g.id ? " is-active" : ""}`}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
      </div>
  );

  return (
    <>
      {mounted && createPortal(island, document.body)}
      <TaskTip tasks={state?.tasks ?? []} plans={plans} colorFor={getTaskCategoryColor} />
      <div className="calendar-page">
        <section className="calendar-toolbar" aria-label="Calendar controls">
          <div className="calendar-toolbar-primary">
            <h1 className="cal-month-heading">
              <span>{headingMonth}</span> <span className="cal-heading-year">{headingYear}</span>
              {headingSpan && <span className="cal-heading-span">{headingSpan}</span>}
            </h1>
          </div>
      </section>

      {activePlan && (
        <div className="plan-filter-banner" style={{ borderLeft: `3px solid ${activePlan.color}` }}>
          <span>Filtering by plan: <strong>{activePlan.title}</strong></span>
          <Button variant="quiet" size="sm" onClick={() => setPlanFilter(null)} icon={<X size={14} aria-hidden="true" />}>Clear filter</Button>
        </div>
      )}

      {view === "week" && (
        <m.section
          key={`wk-${toYMD(weekStart)}`}
          className="calendar-week-shell"
          initial={reduced || monthDir === 0 ? false : { opacity: 0, x: monthDir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", visualDuration: 0.38, bounce: 0.08 }}
        >
          <WeekView
            days={weekDays}
            todayYmd={todayYmd}
            tasksForDay={tasksForDay}
            onOpenTask={(_ymd, id) => openTask(id)}
            labelFor={labelFor}
            colorFor={getTaskCategoryColor}
            onOpenDay={setSelectedDay}
            onAddAt={(ymd, time) => openAddAt(ymd, time)}
            onMoveTask={(t, ymd, time) => void moveTask(t, ymd, time)}
            toYMD={toYMD}
          />
          {moveError && <p className="calendar-move-error" role="alert">{moveError}</p>}
        </m.section>
      )}

      {view === "agenda" && (
        <section className="calendar-agenda-shell" key={`ag-${toYMD(agendaStart)}`}>
          <AgendaView
            onOpenTask={(_ymd, id) => openTask(id)}
            days={agendaDays}
            todayYmd={todayYmd}
            tasksForDay={tasksForDay}
            colorFor={getTaskCategoryColor}
            onOpenDay={setSelectedDay}
            onToggle={(id) => void toggleTask(id)}
            onAdd={(ymd) => openAddAt(ymd)}
            toYMD={toYMD}
          />
        </section>
      )}

      {view === "month" && (
      <section className="calendar-grid-shell">
          <div className="cal-weekday-row" aria-hidden="true">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="cal-weekday-label">
                {d}
              </div>
            ))}
          </div>
          <m.div
            key={`${year}-${month}`}
            className="cal-month-grid"
            initial={reduced || monthDir === 0 ? false : { opacity: 0, x: monthDir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", visualDuration: 0.38, bounce: 0.08 }}
          >
            {cells.map((d, idx) => {
              const inMonth = d.getMonth() === month;
              const ymd = toYMD(d);
              const dayTasks = tasksForDay(ymd);
              const isToday = ymd === todayYmd;
              const isSelected = ymd === selectedDay;
              // The day's own tasks, in time order, shown as chips: the grid
              // answers "what's on" without opening every day.
              const ordered = [...dayTasks].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
              // As many as the cell fits (at least 3, 4 on desktop); the rest
              // is "+N more", which opens the day.
              const shown = ordered.slice(0, ordered.length > perCell ? perCell - 1 : perCell);
              const more = ordered.length - shown.length;
              let className = "cal-cell";
              if (!inMonth) className += " is-outside";
              if (isToday) className += " is-today";
              if (isSelected) className += " is-selected";
              if (ymd < todayYmd) className += " is-past";
              // How full the day is (open work, about five things is a full
              // day): the same iris shade as the week on Today. Past days aren't shaded.
              const openCount = dayTasks.filter((t) => !t.completed).length;
              const load = inMonth && ymd >= todayYmd && openCount > 0 ? Math.min(1, Math.max(0.2, openCount / 5)) : 0;
              return (
                <div key={`${ymd}-${idx}`} className={className} style={{ "--load": load.toFixed(2) } as React.CSSProperties}>
                  <button
                    type="button"
                    className="cal-day"
                    onClick={() => {
                      if (!inMonth) return;
                      setSelectedDay(ymd === selectedDay ? null : ymd);
                    }}
                    aria-label={`${d.toDateString()}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`}
                    disabled={!inMonth}
                  >
                    <span className="d">{d.getDate()}</span>
                    {inMonth && shown.length > 0 && (
                      <span className="cal-events">
                        {shown.map((t) => {
                          // Canvas items and 11:59 PM are due dates, not times
                          // anything happens: a ring, no clock.
                          const deadline = t.source === "canvas" || t.time === "23:59";
                          return (
                            <span
                              key={t.id}
                              className={`cal-event${t.completed ? " is-done" : ""}${isCanvasCleared(t, todayYmd) ? " is-cleared" : ""}${deadline ? " is-deadline" : ""}`}
                              style={{ "--chip": getTaskCategoryColor(t) } as React.CSSProperties}
                              data-task-tip={t.id}
                              onClick={(e) => {
                                // The event opens in the middle, like Google
                                // Calendar; the date opens the day.
                                e.stopPropagation();
                                openTask(t.id);
                              }}
                            >
                              <span className="cal-event-dot" aria-hidden="true" />
                              <span className="cal-event-title">{labelFor(t)}</span>
                            </span>
                          );
                        })}
                        {more > 0 && (
                          <span
                            className="cal-event-more"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(ymd);
                            }}
                          >
                            +{more} more
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                  {inMonth && (
                    <button
                      type="button"
                      className="cal-day-add"
                      aria-label={`Add a task on ${d.toDateString()}`}
                      title="Add a task"
                      onClick={() => {
                        setAddModalDate(ymd);
                        setAddModalTime(undefined);
                        setShowAddModal(true);
                      }}
                    >
                      <Plus size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </m.div>
        </section>
      )}
      </div>

      {selectedDay && (
        <SidePeek open titleId="calendar-day-title" onClose={() => { setSelectedDay(null); setRemoved(null); }}>
          <div className="calendar-peek-content">
            <div className="calendar-modal-header">
              <span className="calendar-peek-kicker">Selected day</span>
              <h3 id="calendar-day-title" className="calendar-modal-date">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              {/* The count only. An empty day is announced once, by the
                  empty state below — it used to say "No tasks for this day."
                  here and "Nothing scheduled yet." directly underneath. */}
              {selectedDayTasks.length > 0 && (
                <p className="calendar-modal-subhead">
                  {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? "s" : ""}
                </p>
              )}
              {removed && (
                <div className="calendar-removed">
                  <ActionReceipt
                    actionId={removed.actionId}
                    label={removed.label ?? `Removed “${removed.title}”`}
                    onUndone={() => {
                      setRemoved(null);
                      void refresh();
                    }}
                  />
                </div>
              )}
            </div>

            {selectedDayTasks.length === 0 ? (
              <p className="calendar-modal-empty">Nothing scheduled yet.</p>
            ) : (
              <div>
                {groupByCategory(selectedDayTasks).map(({ category, tasks }) => (
                <div key={category} className="day-panel-kind-group">
                  <div className="day-panel-kind-header">
                    <span className="day-panel-kind-pill" style={{ background: CATEGORY_COLOR[category] }} />
                    <span className="day-panel-kind-label">{CATEGORY_LABEL[category]}</span>
                  </div>
                  {tasks.map((t) => {
                  const plan = getPlan(t.planId);
                  const freq = recurringLabel(t);
                  const categoryColor = getTaskCategoryColor(t);
                  return (
                    <div key={t.id} className={`calendar-modal-task${t.completed ? " calendar-modal-task--done" : ""}`} style={{ borderLeftColor: categoryColor }}>
                      <div className="calendar-modal-task-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                          <button
                            type="button"
                            className="ui-task-check"
                            aria-pressed={t.completed}
                            aria-label={`${t.completed ? "Mark incomplete" : "Complete"} ${t.title}`}
                            onClick={() => void toggleTask(t.id)}
                          >
                            {t.completed && <Check size={12} strokeWidth={2.8} aria-hidden="true" />}
                          </button>
                          <span className={`calendar-modal-task-title${t.completed ? " done" : ""}`} data-task-tip={t.id}><TaskTitle task={t} /></span>
                          {t.recurring?.enabled && (
                            <span className="recurring-badge" title={freq || "Recurring"}><Repeat size={12} strokeWidth={1.75} /></span>
                          )}
                        </div>
                        <span className="calendar-modal-task-time">{formatTime12(t.time)}</span>
                      </div>
                      {freq && <div className="recurring-freq-label">{freq}</div>}
                      {plan && (
                        <button
                          className="plan-tag"
                          style={{ background: plan.color + "22", color: plan.color, borderColor: plan.color + "44" }}
                          onClick={() => { setPlanFilter(t.planId ?? null); setSelectedDay(null); }}
                          title={`Filter by plan: ${plan.title}`}
                        >
                          {plan.title}
                        </button>
                      )}
                      {t.pathOrigin && (
                        <Link
                          href={`/tangents/${t.pathOrigin.pathId}`}
                          className="path-origin-link"
                          title={t.pathOrigin.nodeTitle}
                        >
                          From your {t.pathOrigin.pathTitle} path
                        </Link>
                      )}
                      {t.notes && (
                        <div className="calendar-modal-task-desc">
                          <p className={`calendar-task-notes${openNotes.has(t.id) ? " is-open" : ""}`}>{t.notes}</p>
                          {t.notes.length > 140 && (
                            <button
                              type="button"
                              className="calendar-task-more"
                              onClick={() =>
                                setOpenNotes((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(t.id)) next.delete(t.id);
                                  else next.add(t.id);
                                  return next;
                                })
                              }
                            >
                              {openNotes.has(t.id) ? "Show less" : "Show more"}
                            </button>
                          )}
                          {t.resources && t.resources.length > 0 && (
                            <div className="resource-links-section">
                              {t.resources.map((r, i) => (
                                <button key={`${r.url}-${i}`} type="button" onClick={() => handleResourceClick(r, t)} className="resource-link">
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                        {t.recurring?.enabled ? (
                          <button
                            onClick={() => setRecurEditTarget({ taskId: t.id, parentId: t.recurring!.parentId!, task: t })}
                            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem", padding: "0 0.2rem", lineHeight: 1, flexShrink: 0 }}
                            aria-label={`Edit ${t.title}`}
                            title="Edit recurring"
                          >
                            <Pencil size={14} strokeWidth={1.75} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="calendar-task-remove"
                          onClick={() => handleDeleteTask(t)}
                          aria-label={`Remove ${t.title}`}
                          aria-expanded={removePick === t.id}
                        >
                          Remove
                        </button>
                      </div>
                      {removePick === t.id && (
                        <div className="calendar-remove-pick">
                          <ClarifyCard
                            key={t.id}
                            questions={[
                              {
                                id: "remove",
                                question: "Remove which tasks?",
                                options: [...removeLabels(selectedDayTasks).map((l) => l.label), "All of these"],
                                multi: true,
                                submitLabel: "Delete selected",
                              },
                            ]}
                            initial={{ remove: removeLabels(selectedDayTasks).filter((l) => l.task.id === t.id).map((l) => l.label) }}
                            other={false}
                            skipLabel="Cancel"
                            onSubmit={(answers) => void removePicked(answers)}
                          />
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              className="calendar-peek-add"
              onClick={() => {
                setAddModalDate(selectedDay);
                setAddModalTime(undefined);
                setShowAddModal(true);
                setSelectedDay(null);
              }}
            >
              <PlusCircle size={16} strokeWidth={1.75} /> Add task for this day
            </Button>

            <details className="calendar-modal-chat">
              <summary>Ask about this day</summary>
              {dayChatMessages.length > 0 && (
                <div className="calendar-modal-chat-log">
                  {dayChatMessages.map((m, i) => (
                    <div key={i} className={`chat-row ${m.role === "user" ? "user-row" : "assistant-row"}`}>
                      {!(m.draft && m.content.trim() === m.draft.changeSet.summary.trim()) && (
                        <div className={`bubble ${m.role}`}>{m.content}</div>
                      )}
                      {m.questions && m.questions.length > 0 && (
                        <ClarifyCard
                          questions={m.questions}
                          disabled={dayChatBusy}
                          skipLabel={m.pendingQuestion ? "Cancel" : undefined}
                          echo={m.content}
                          onSubmit={(answers) => answerDayChat(i, answers)}
                        />
                      )}
                      {m.draft && <PreviewCard changeSet={m.draft.changeSet} preview={m.draft.preview} onChanged={() => void refresh()} />}
                      {m.pendingConfirm && (
                        <div className="tg-confirm">
                          <Button size="sm" variant="primary" onClick={() => void confirmDayChat(i, m.pendingConfirm!.id, true)}>
                            Confirm
                          </Button>
                          <Button size="sm" onClick={() => void confirmDayChat(i, m.pendingConfirm!.id, false)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {m.actionId && !m.draft && <ActionReceipt actionId={m.actionId} label="Change applied" onUndone={() => void refresh()} />}
                    </div>
                  ))}
                  {dayChatBusy && (
                    <div className="chat-row assistant-row">
                      <div className="bubble assistant chat-loading-bubble" aria-busy>
                        <div className="typing-dots">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void sendDayChat(); }}>
                <input
                  value={dayChatInput}
                  onChange={(e) => setDayChatInput(e.target.value)}
                  placeholder="Ask about this day..."
                  aria-label="Ask about this day"
                  disabled={dayChatBusy}
                />
                <Button type="submit" variant="primary" size="sm" disabled={dayChatBusy || !dayChatInput.trim()}>
                  {dayChatBusy ? "Sending…" : "Send"}
                </Button>
              </form>
            </details>
          </div>
        </SidePeek>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          initialDate={addModalDate}
          initialTime={addModalTime}
          initialCalendarId={null}
          onClose={() => {
            setShowAddModal(false);
            setAddModalTime(undefined);
            setSelectedDay(addModalDate);
          }}
          onSuccess={() => void refresh()}
          onDuplicate={() => {
            setDuplicateToast(true);
            window.setTimeout(() => setDuplicateToast(false), 3000);
          }}
        />
      )}

      {duplicateToast && (
        <div className="command-toast" role="status">
          <span>Already on your calendar</span>
        </div>
      )}

      {/* Recurring delete modal */}
      {recurDeleteTarget && (
        <div className="modal-overlay" onClick={() => setRecurDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3>Delete recurring task</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.5rem 0 1.25rem" }}>
              <strong style={{ color: "var(--text)" }}>{recurDeleteTarget.title}</strong> is a recurring task. Delete just this occurrence or all future occurrences?
            </p>
            <div className="modal-actions">
              <button className="btn-ghost surface-action-secondary" onClick={() => setRecurDeleteTarget(null)} disabled={recurDeleting}>Cancel</button>
              <button className="btn-ghost" onClick={() => void confirmRecurDelete(false)} disabled={recurDeleting}>
                {recurDeleting ? "Deleting…" : "Just this one"}
              </button>
              <button
                className="btn"
                onClick={() => void confirmRecurDelete(true)}
                disabled={recurDeleting}
                style={{ background: "var(--red)", borderColor: "var(--red)", color: "#fff" }}
              >
                {recurDeleting ? "Deleting…" : "All occurrences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring edit modal */}
      {recurEditTarget && (
        <div className="modal-overlay" onClick={() => setRecurEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit recurring task</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.5rem 0 1.25rem" }}>
              <strong style={{ color: "var(--text)" }}>{recurEditTarget.task.title}</strong> — mark as complete for which occurrences?
            </p>
            <div className="modal-actions">
              <button className="btn-ghost surface-action-secondary" onClick={() => setRecurEditTarget(null)}>Cancel</button>
              <button
                className="btn-ghost"
                onClick={() => {
                  void (async () => {
                    await fetch("/api/tasks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "toggle_task", id: recurEditTarget.taskId }),
                    });
                    setRecurEditTarget(null);
                    await refresh();
                  })();
                }}
              >
                Just this one
              </button>
              <button
                className="btn"
                onClick={() => {
                  void (async () => {
                    await fetch("/api/tasks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update_recurring", id: recurEditTarget.taskId, updateAll: true, patch: { completed: !recurEditTarget.task.completed } }),
                    });
                    setRecurEditTarget(null);
                    await refresh();
                  })();
                }}
              >
                All occurrences
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
