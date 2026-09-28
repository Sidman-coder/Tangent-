"use client";

import { useState, useCallback, useEffect } from "react";
import { m, useReducedMotion } from "motion/react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { wallClockNow } from "@/lib/time";
import AddTaskModal from "@/components/AddTaskModal";
import Button from "@/components/ui/Button";
import SidePeek from "@/components/ui/SidePeek";
import { handleResourceClick } from "@/lib/task-utils";
import { toYMD, formatTime12 } from "@/lib/dates";
import { taskColor } from "@/lib/task-colors";
import type { Plan, Task } from "@/lib/types";
import { X, ChevronLeft, ChevronRight, Plus, PlusCircle, Repeat, Pencil } from "lucide-react";
import WeekView from "@/components/calendar/WeekView";
import AgendaView from "@/components/calendar/AgendaView";

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

function getKindColor(kind?: string): string {
  const map: Record<string, string> = {
    'school':      '#2563eb',
    'commitment':  '#0d9488',
    'academic-ec': '#7c3aed',
    'side-ec':     '#d97706',
    'personal':    '#64748b',
  }
  return map[kind ?? ''] ?? '#9b97a6'
}

const KIND_SORT_ORDER = ["school", "academic-ec", "commitment", "side-ec", "personal"];
const KIND_DISPLAY_NAME: Record<string, string> = {
  school: "School",
  commitment: "Commitment",
  "academic-ec": "Academics",
  "side-ec": "Activities",
  personal: "Personal time",
};
const NO_KIND = "__none__";

function sortKindKeys(keys: string[]): string[] {
  return keys.slice().sort((a, b) => {
    const ai = a === NO_KIND ? KIND_SORT_ORDER.length : KIND_SORT_ORDER.indexOf(a);
    const bi = b === NO_KIND ? KIND_SORT_ORDER.length : KIND_SORT_ORDER.indexOf(b);
    return ai - bi;
  });
}

function groupTasksByKind(tasks: Task[]): { kind: string | undefined; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.kind ?? NO_KIND;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return sortKindKeys(Array.from(groups.keys())).map((key) => ({
    kind: key === NO_KIND ? undefined : key,
    tasks: groups.get(key)!,
  }));
}

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

/** "4:00 PM" becomes "4p", "4:30 PM" becomes "4:30p": chip-sized. */
function shortTime(hhmm: string): string {
  const [h, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const suffix = h < 12 ? "a" : "p";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return mm ? `${hour}:${String(mm).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export default function CalendarPage() {
  const { state, refresh } = useAppState();
  const now = wallClockNow(useUserTimezone());
  const todayYmd = toYMD(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calIdx, setCalIdx] = useState(0);
  const [view, setView] = useState<CalView>("month");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [agendaStart, setAgendaStart] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [newCalName, setNewCalName] = useState("");
  const [showAddCal, setShowAddCal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState(todayYmd);
  const [addModalTime, setAddModalTime] = useState<string | undefined>(undefined);
  const [duplicateToast, setDuplicateToast] = useState(false);
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState<RecurDeleteTarget | null>(null);
  const [recurEditTarget, setRecurEditTarget] = useState<RecurEditTarget | null>(null);
  const [recurDeleting, setRecurDeleting] = useState(false);
  const [dayChatMessages, setDayChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [dayChatInput, setDayChatInput] = useState("");
  const [dayChatBusy, setDayChatBusy] = useState(false);

  const calendars = state?.calendars ?? [{ id: "cal_all", name: "All Calendars", category: "ALL" }];
  const activeCal = calendars[calIdx] ?? calendars[0];
  const plans: Plan[] = state?.plans ?? [];

  const getPlan = useCallback((planId: string | null | undefined): Plan | null => {
    if (!planId) return null;
    return plans.find((p) => p.id === planId) ?? null;
  }, [plans]);

  const getTaskCategoryColor = useCallback(
    (t: Task): string => taskColor(t, plans, calendars),
    [plans, calendars]
  );

  const tasksForDay = useCallback((ymd: string): Task[] => {
    let tasks = state?.tasks ?? [];
    if (activeCal.category !== "ALL") tasks = tasks.filter((t) => t.calendarId === activeCal.id);
    if (planFilter) tasks = tasks.filter((t) => t.planId === planFilter);
    return tasks.filter((t) => t.date === ymd);
  }, [state, activeCal, planFilter]);

  const selectedDayTasks = selectedDay
    ? tasksForDay(selectedDay).slice().sort((a, b) => a.time.localeCompare(b.time))
    : [];

  // Remember the chosen view; first visit gets the week grid on wide screens
  // and the agenda list on phones, where seven columns can't breathe.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(VIEW_KEY); } catch { /* storage blocked */ }
    if (saved === "week" || saved === "month" || saved === "agenda") setView(saved);
    else setView(window.matchMedia("(max-width: 720px)").matches ? "agenda" : "week");
  }, []);

  const chooseView = (next: CalView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* storage blocked */ }
  };

  // Reset the day-chat thread whenever a different day is opened
  useEffect(() => {
    setDayChatMessages([]);
    setDayChatInput("");
  }, [selectedDay]);

  const sendDayChat = useCallback(async () => {
    const text = dayChatInput.trim();
    if (!text || !selectedDay || dayChatBusy) return;
    setDayChatBusy(true);
    setDayChatInput("");

    const dateLabel = new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const taskSummary = selectedDayTasks.length
      ? selectedDayTasks.map((t) => `- ${t.time} ${t.title}${t.completed ? " (done)" : ""}${t.notes ? `: ${t.notes}` : ""}`).join("\n")
      : "No tasks scheduled.";
    const contextualMessage = `Context: the user is looking at ${dateLabel}. Tasks for that day:\n${taskSummary}\n\nQuestion: ${text}`;

    const nextMessages = [...dayChatMessages, { role: "user" as const, content: text }];
    setDayChatMessages(nextMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...dayChatMessages, { role: "user", content: contextualMessage }],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      const reply = data.ok && data.message ? data.message : (data.error || "Something went wrong.");
      setDayChatMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setDayChatMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the assistant." }]);
    } finally {
      setDayChatBusy(false);
    }
  }, [dayChatInput, dayChatBusy, selectedDay, dayChatMessages, selectedDayTasks]);

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

  const addCalendar = async () => {
    const name = newCalName.trim();
    if (!name) return;
    await fetch("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewCalName("");
    setShowAddCal(false);
    await refresh();
  };

  const toggleTask = async (id: string) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_task", id }),
    });
    await refresh();
  };

  const handleDeleteTask = (t: Task) => {
    if (t.recurring?.enabled && t.recurring.parentId) {
      setRecurDeleteTarget({ taskId: t.id, parentId: t.recurring.parentId, title: t.title });
    } else {
      void (async () => {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete_task", id: t.id }),
        });
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
      setSelectedDay(null); setShowAddModal(false); setRecurDeleteTarget(null); setRecurEditTarget(null); setShowAddCal(false);
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

  return (
    <>
      <div className="calendar-page">
        <section className="calendar-toolbar" aria-label="Calendar controls">
          <div className="calendar-toolbar-primary">
            <h1 className="cal-month-heading">
              <span>{headingMonth}</span> <span className="cal-heading-year">{headingYear}</span>
              {headingSpan && <span className="cal-heading-span">{headingSpan}</span>}
            </h1>
            <div className="cal-nav-group">
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
                      <m.span layoutId="cal-view-pill" className="cal-view-pill" transition={{ type: "spring", visualDuration: 0.3, bounce: 0.15 }} />
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
              </div>
            </div>
          </div>
          <div className="cal-segment-bar" role="tablist" aria-label="Filter by calendar">
            {calendars.map((cal, idx) => (
              <button
                key={cal.id}
                type="button"
                role="tab"
                aria-selected={idx === calIdx}
                className={`cal-segment${idx === calIdx ? " is-active" : ""}`}
                onClick={() => setCalIdx(idx)}
              >
                {cal.category !== "ALL" && (cal as { color?: string }).color && (
                  <span className="cal-segment-dot" style={{ background: (cal as { color?: string }).color }} />
                )}
                {cal.name}
              </button>
            ))}
            <button type="button" className="cal-segment cal-segment-add" onClick={() => setShowAddCal((value) => !value)} aria-label="Add calendar" title="Add new calendar">
              <Plus size={16} strokeWidth={1.75} />
            </button>
          </div>

          <details className="cal-kind-legend">
            <summary aria-label="Show task kind colors">Kinds</summary>
            <div className="cal-kind-legend-panel">
              {KIND_SORT_ORDER.map((kind) => (
                <span key={kind} className="cal-kind-legend-item">
                  <span className="cal-kind-legend-dot" style={{ background: getKindColor(kind) }} />
                  {KIND_DISPLAY_NAME[kind]}
                </span>
              ))}
            </div>
          </details>

        {showAddCal && (
          <div className="cal-add-cal-row">
            <input
              aria-label="New calendar name"
              placeholder="New calendar name…"
              value={newCalName}
              onChange={(e) => setNewCalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void addCalendar(); }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={() => void addCalendar()}>Add</Button>
          </div>
        )}
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
            colorFor={(t) => getKindColor(t.kind)}
            onOpenDay={setSelectedDay}
            onAddAt={(ymd, time) => openAddAt(ymd, time)}
            toYMD={toYMD}
          />
        </m.section>
      )}

      {view === "agenda" && (
        <section className="calendar-agenda-shell" key={`ag-${toYMD(agendaStart)}`}>
          <AgendaView
            days={agendaDays}
            todayYmd={todayYmd}
            tasksForDay={tasksForDay}
            colorFor={(t) => getKindColor(t.kind)}
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
              const shown = ordered.slice(0, 3);
              const more = ordered.length - shown.length;
              let className = "cal-cell";
              if (!inMonth) className += " is-outside";
              if (isToday) className += " is-today";
              if (isSelected) className += " is-selected";
              return (
                <div key={`${ymd}-${idx}`} className={className}>
                  <button
                    type="button"
                    className="cal-day"
                    onClick={() => inMonth && setSelectedDay(ymd === selectedDay ? null : ymd)}
                    aria-label={`${d.toDateString()}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`}
                    disabled={!inMonth}
                  >
                    <span className="d">{d.getDate()}</span>
                    {inMonth && shown.length > 0 && (
                      <span className="cal-chips">
                        {shown.map((t) => (
                          <span
                            key={t.id}
                            className={`cal-chip${t.completed ? " is-done" : ""}`}
                            style={{ "--chip": getKindColor(t.kind) } as React.CSSProperties}
                          >
                            {t.time && <span className="cal-chip-time">{shortTime(t.time)}</span>}
                            <span className="cal-chip-title">{t.title}</span>
                          </span>
                        ))}
                        {more > 0 && <span className="cal-chip-more">+{more} more</span>}
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
        <SidePeek open titleId="calendar-day-title" onClose={() => setSelectedDay(null)}>
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
            </div>

            {selectedDayTasks.length === 0 ? (
              <p className="calendar-modal-empty">Nothing scheduled yet.</p>
            ) : (
              <div>
                {groupTasksByKind(selectedDayTasks).map(({ kind, tasks }) => (
                <div key={kind ?? "other"} className="day-panel-kind-group">
                  <div className="day-panel-kind-header">
                    <span className="day-panel-kind-pill" style={{ background: getKindColor(kind) }} />
                    <span className="day-panel-kind-label">{KIND_DISPLAY_NAME[kind ?? ""] ?? "Other"}</span>
                  </div>
                  {tasks.map((t) => {
                  const plan = getPlan(t.planId);
                  const freq = recurringLabel(t);
                  const categoryColor = getTaskCategoryColor(t);
                  return (
                    <div key={t.id} className={`calendar-modal-task${t.completed ? " calendar-modal-task--done" : ""}`} style={{ borderLeftColor: categoryColor }}>
                      <div className="calendar-modal-task-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => void toggleTask(t.id)}
                            aria-label={`Mark ${t.title} complete`}
                          />
                          <span className={`calendar-modal-task-title${t.completed ? " done" : ""}`}>{t.title}</span>
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
                      {t.notes && (
                        <div className="calendar-modal-task-desc">
                          {t.notes}
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
                          onClick={() => handleDeleteTask(t)}
                          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.85rem", padding: "0 0.25rem", lineHeight: 1, flexShrink: 0 }}
                          aria-label={`Delete ${t.title}`}
                          title="Delete task"
                        >
                          <X size={16} strokeWidth={1.75} />
                        </button>
                      </div>
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
                      <div className={`bubble ${m.role}`}>{m.content}</div>
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
          initialCalendarId={activeCal.category !== "ALL" ? activeCal.id : null}
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
                style={{ background: "linear-gradient(135deg,#7f1d1d,#991b1b)", borderColor: "#ef4444" }}
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
