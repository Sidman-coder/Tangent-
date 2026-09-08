"use client";

import { useState, useCallback, useEffect } from "react";
import { useAppState } from "@/components/AppStateProvider";
import AddTaskModal from "@/components/AddTaskModal";
import { handleResourceClick } from "@/lib/task-utils";
import { toYMD } from "@/lib/dates";
import type { Plan, Task } from "@/lib/types";
import { X, ChevronLeft, ChevronRight, Plus, PlusCircle, Repeat, Pencil, Sparkles } from "lucide-react";

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
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

export default function CalendarPage() {
  const { state, refresh } = useAppState();
  const now = new Date();
  const todayYmd = toYMD(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calIdx, setCalIdx] = useState(0);
  const [newCalName, setNewCalName] = useState("");
  const [showAddCal, setShowAddCal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState(todayYmd);
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [recurDeleteTarget, setRecurDeleteTarget] = useState<RecurDeleteTarget | null>(null);
  const [recurEditTarget, setRecurEditTarget] = useState<RecurEditTarget | null>(null);
  const [recurDeleting, setRecurDeleting] = useState(false);
  const [dayChatMessages, setDayChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [dayChatInput, setDayChatInput] = useState("");
  const [dayChatBusy, setDayChatBusy] = useState(false);
  const [logSidebarOpen, setLogSidebarOpen] = useState(false);
  const [agentMessages, setAgentMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  const calendars = state?.calendars ?? [{ id: "cal_all", name: "All Calendars", category: "ALL" }];
  const activeCal = calendars[calIdx] ?? calendars[0];
  const plans: Plan[] = state?.plans ?? [];

  const getPlan = useCallback((planId: string | null | undefined): Plan | null => {
    if (!planId) return null;
    return plans.find((p) => p.id === planId) ?? null;
  }, [plans]);

  const getTaskCategoryColor = useCallback((t: Task): string => {
    const plan = getPlan(t.planId);
    if (plan) return plan.color;
    const cal = calendars.find((c) => c.id === t.calendarId);
    if (cal) {
      if (cal.category === "work") return "var(--cal-work)";
      if (cal.category === "personal") return "var(--cal-personal)";
      if (cal.category !== "ALL") return "var(--cal-all)";
    }
    return PRIORITY_COLOR[t.priority];
  }, [getPlan, calendars]);

  const tasksForDay = useCallback((ymd: string): Task[] => {
    let tasks = state?.tasks ?? [];
    if (activeCal.category !== "ALL") tasks = tasks.filter((t) => t.calendarId === activeCal.id);
    if (planFilter) tasks = tasks.filter((t) => t.planId === planFilter);
    return tasks.filter((t) => t.date === ymd);
  }, [state, activeCal, planFilter]);

  const selectedDayTasks = selectedDay
    ? tasksForDay(selectedDay).slice().sort((a, b) => a.time.localeCompare(b.time))
    : [];

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

  const handleAgentSend = useCallback(async () => {
    const text = agentInput.trim();
    if (!text || agentLoading) return;
    setAgentLoading(true);
    setAgentInput("");

    const nextMessages = [...agentMessages, { role: "user" as const, content: text }];
    setAgentMessages(nextMessages);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      const reply = data.ok && data.message ? data.message : (data.error || "Something went wrong.");
      setAgentMessages((m) => [...m, { role: "assistant", content: reply }]);
      await refresh();
    } catch {
      setAgentMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the assistant." }]);
    } finally {
      setAgentLoading(false);
    }
  }, [agentInput, agentLoading, agentMessages, refresh]);

  const cells = getMonthGrid(year, month);

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  const addCalendar = async () => {
    const name = newCalName.trim();
    if (!name) return;
    await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands: [{ type: "ADD_CALENDAR", name, category: "personal" }] }),
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
      setSelectedDay(null); setShowAddModal(false); setRecurDeleteTarget(null); setRecurEditTarget(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openTaskDate = useCallback((ymd: string) => {
    const d = new Date(`${ymd}T00:00:00`);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDay(ymd);
  }, []);

  // Cross-page "View Task" navigation from WhatToDoNow lands here with ?date=YYYY-MM-DD
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      openTaskDate(dateParam);
      window.history.replaceState(null, "", "/calendar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  const activePlan = planFilter ? getPlan(planFilter) : null;

  return (
    <>
      {/* Plan filter banner */}
      {activePlan && (
        <div className="plan-filter-banner" style={{ borderLeft: `3px solid ${activePlan.color}` }}>
          <span>Filtering by plan: <strong>{activePlan.title}</strong></span>
          <button className="btn-ghost surface-action-secondary" style={{ fontSize: "0.78rem", padding: "0.2rem 0.5rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }} onClick={() => setPlanFilter(null)}>
            <X size={16} strokeWidth={1.75} /> Clear filter
          </button>
        </div>
      )}

      {/* Calendar filter — segmented control */}
      <section className="cal-segment-card">
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
          <button
            type="button"
            className="cal-segment cal-segment-add"
            onClick={() => setShowAddCal((v) => !v)}
            aria-label="Add calendar"
            title="Add new calendar"
          >
            <Plus size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Add calendar form — slides open under the segmented control */}
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
            <button className="btn surface-action-primary" onClick={() => void addCalendar()}>Add</button>
          </div>
        )}
      </section>

      {/* Month grid */}
      <section className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2 className="cal-month-heading">{monthLabel}</h2>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button className="btn btn-secondary surface-action-secondary" onClick={prevMonth} style={{ display: "inline-flex", alignItems: "center" }}><ChevronLeft size={16} strokeWidth={1.75} /> Prev</button>
            <button className="btn btn-secondary surface-action-secondary" onClick={nextMonth} style={{ display: "inline-flex", alignItems: "center" }}>Next <ChevronRight size={16} strokeWidth={1.75} /></button>
          </div>
        </div>

        <div className="cal-month-grid" style={{ marginTop: "0.75rem" }}>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="cal-weekday-label">
              {d}
            </div>
          ))}

          {cells.map((d, idx) => {
            const inMonth = d.getMonth() === month;
            const ymd = toYMD(d);
            const dayTasks = tasksForDay(ymd);
            const isToday = ymd === todayYmd;
            const isSelected = ymd === selectedDay;
            const hasRecurring = dayTasks.some((t) => t.recurring?.enabled);
            const activityLevel = dayTasks.length === 0 ? 0 : dayTasks.length === 1 ? 1 : dayTasks.length === 2 ? 2 : 3;
            const activityTint =
              activityLevel === 1 ? "rgb(from var(--accent) r g b / 0.04)"
              : activityLevel === 2 ? "rgb(from var(--accent) r g b / 0.08)"
              : activityLevel === 3 ? "rgb(from var(--accent) r g b / 0.14)"
              : undefined;
            let className = "cal-day";
            if (isToday) className += " is-today";
            if (isSelected) className += " is-selected";
            return (
              <div
                key={`${ymd}-${idx}`}
                className={className}
                style={{ opacity: inMonth ? 1 : 0.3, background: !isToday ? activityTint : undefined }}
                onClick={() => inMonth && setSelectedDay(ymd === selectedDay ? null : ymd)}
                role="button"
                aria-label={`${d.toDateString()}${dayTasks.length ? `, ${dayTasks.length} tasks` : ""}`}
              >
                {isToday && <span className="cal-day-today-dot" aria-hidden="true" />}
                <div className="d">{d.getDate()}</div>
                <div className="task-dot-row">
                  {dayTasks.slice(0, 5).map((t, i) => (
                    <span
                      key={i}
                      className={`task-dot${t.recurring?.enabled ? " task-dot-recurring" : ""}`}
                      style={{ background: getTaskCategoryColor(t), color: getTaskCategoryColor(t) }}
                      title={t.title}
                    />
                  ))}
                  {hasRecurring && dayTasks.length <= 5 && (
                    <span className="recurring-dot-icon" title="Has recurring tasks"><Repeat size={10} strokeWidth={1.75} /></span>
                  )}
                </div>
                {dayTasks.length > 0 && (
                  <span style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: "0.15rem", display: "block" }}>
                    {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Calendar date-click modal */}
      {selectedDay && (
        <div className="calendar-modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="calendar-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <button className="calendar-modal-close" onClick={() => setSelectedDay(null)} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>
              <h3 className="calendar-modal-date">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              <p className="calendar-modal-subhead">
                {selectedDayTasks.length === 0 ? "No tasks for this day." : `${selectedDayTasks.length} task${selectedDayTasks.length !== 1 ? "s" : ""}`}
              </p>
            </div>

            {selectedDayTasks.length === 0 ? (
              <p className="calendar-modal-empty">Nothing scheduled yet.</p>
            ) : (
              <div>
                {selectedDayTasks.map((t) => {
                  const plan = getPlan(t.planId);
                  const freq = recurringLabel(t);
                  const categoryColor = getTaskCategoryColor(t);
                  return (
                    <div key={t.id} className="calendar-modal-task" style={{ borderLeftColor: categoryColor }}>
                      <div className="calendar-modal-task-top">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={t.completed}
                            onChange={() => void toggleTask(t.id)}
                            aria-label={`Mark ${t.title} complete`}
                          />
                          <span
                            className="priority-dot"
                            style={{ background: PRIORITY_COLOR[t.priority] }}
                            title={`Priority: ${t.priority}`}
                          />
                          <span className={`calendar-modal-task-title${t.completed ? " done" : ""}`}>{t.title}</span>
                          {t.recurring?.enabled && (
                            <span className="recurring-badge" title={freq || "Recurring"}><Repeat size={12} strokeWidth={1.75} /></span>
                          )}
                        </div>
                        <span className="calendar-modal-task-time">{t.time}</span>
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
            )}

            <button
              className="add-task-btn neu-btn-primary"
              style={{ marginTop: "0.75rem" }}
              onClick={() => {
                setAddModalDate(selectedDay);
                setShowAddModal(true);
                setSelectedDay(null);
              }}
            >
              <PlusCircle size={16} strokeWidth={1.75} /> Add task for this day
            </button>

            {/* Ask about this day — wired to the general chat pipeline */}
            <div className="calendar-modal-chat">
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
                <button type="submit" className="btn surface-action-primary" disabled={dayChatBusy || !dayChatInput.trim()}>
                  {dayChatBusy ? "Sending…" : "Send"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          initialDate={addModalDate}
          initialCalendarId={activeCal.category !== "ALL" ? activeCal.id : null}
          onClose={() => {
            setShowAddModal(false);
            setSelectedDay(addModalDate);
          }}
          onSuccess={() => void refresh()}
        />
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

      {/* Sidebar toggle */}
      <button
        className="log-sidebar-toggle"
        onClick={() => setLogSidebarOpen((v) => !v)}
        aria-label={logSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        <Sparkles size={16} strokeWidth={1.75} /> Agent
      </button>

      {/* Collapsible AI agent chat sidebar */}
      <div className={`log-sidebar${logSidebarOpen ? " open" : ""}`}>
        <div className="log-sidebar-header">
          <span className="t-label"><Sparkles size={16} strokeWidth={1.75} /> Agent</span>
          <button className="log-sidebar-close" onClick={() => setLogSidebarOpen(false)} aria-label="Close"><X size={16} strokeWidth={1.75} /></button>
        </div>

        <div className="agent-sidebar-body">
          <div className="agent-sidebar-messages">
            {agentMessages.length === 0 ? (
              <p className="log-sidebar-empty">Ask the agent to add tasks, move things between calendars, or answer questions about your schedule.</p>
            ) : (
              agentMessages.map((m, i) => (
                <div key={i} className={`agent-msg agent-msg-${m.role}`}>{m.content}</div>
              ))
            )}
            {agentLoading && <div className="agent-msg agent-msg-assistant">Thinking…</div>}
          </div>
          <form
            className="agent-sidebar-input-row"
            onSubmit={(e) => { e.preventDefault(); void handleAgentSend(); }}
          >
            <input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              placeholder="Ask the agent…"
              disabled={agentLoading}
              aria-label="Message the AI agent"
            />
            <button type="submit" className="btn surface-action-primary" disabled={agentLoading || !agentInput.trim()}>
              {agentLoading ? "…" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
