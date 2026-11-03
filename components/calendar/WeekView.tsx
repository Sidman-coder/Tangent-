"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import type { Task } from "@/lib/types";
import TaskTitle from "@/components/ui/TaskTitle";
import { isCanvasCleared } from "@/lib/canvas-clear";
import { canDragTask, dropTarget, minutesToTime, nudge, overlapAt } from "@/lib/calendar-drag";

// The week as a time grid: seven day columns, hours down the side, each task a
// block at its time. This is the view people now expect from a calendar - you
// see how the day is actually shaped, where the gaps are, and what collides.
//
// Tasks have a start time but no duration, so each block is drawn a fixed
// 45 minutes tall. Two tasks within that window of each other share the column
// side by side instead of stacking on top of one another.

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_PX = 56;
const BLOCK_MIN = 45;
const LONG_PRESS_MS = 400;
/** Mouse travel that starts a drag; finger travel that means "scrolling" instead. */
const DRAG_THRESHOLD_PX = 5;
const TOUCH_SLOP_PX = 8;
const EDGE_SCROLL_PX = 40;

type Gesture = {
  task: Task;
  pointerId: number;
  touch: boolean;
  target: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabY: number;
  active: boolean;
  timer?: number;
};

type Props = {
  days: Date[];
  todayYmd: string;
  tasksForDay: (ymd: string) => Task[];
  /** Concise label for a narrow block; the full title shows on hover. */
  labelFor?: (task: Task) => string;
  /** One event clicked: open just it (the day header opens the whole day). */
  onOpenTask?: (ymd: string, taskId: string) => void;
  colorFor: (task: Task) => string;
  onOpenDay: (ymd: string) => void;
  onAddAt: (ymd: string, time: string) => void;
  /** Dropped on a new day or time. Without it, blocks don't drag. */
  onMoveTask?: (task: Task, ymd: string, time: string) => void;
  toYMD: (d: Date) => string;
};

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function label(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function time12(time: string): string {
  const mins = minutesOf(time);
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** Side-by-side lanes for tasks that would overlap within one block's height. */
/** A due date, not an appointment: Canvas items and 11:59 PM. */
function isDue(t: Task): boolean {
  return t.source === "canvas" || t.time === "23:59";
}

function lanes(tasks: Task[]): { task: Task; lane: number; of: number }[] {
  const sorted = [...tasks].sort((a, b) => minutesOf(a.time) - minutesOf(b.time));
  const placed: { task: Task; lane: number; of: number }[] = [];
  let cluster: { task: Task; lane: number; of: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const of = cluster.reduce((m, c) => Math.max(m, c.lane + 1), 1);
    for (const c of cluster) c.of = of;
    placed.push(...cluster);
    cluster = [];
  };
  for (const task of sorted) {
    const start = minutesOf(task.time);
    if (start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => minutesOf(c.task.time) + BLOCK_MIN > start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ task, lane, of: 1 });
    clusterEnd = Math.max(clusterEnd, start + BLOCK_MIN);
  }
  if (cluster.length) flush();
  return placed;
}

export default function WeekView({ days, todayYmd, tasksForDay, colorFor, onOpenDay, onOpenTask, labelFor, onAddAt, onMoveTask, toYMD }: Props) {
  const reduced = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ taskId: string; ymd: string; minutes: number; color: string } | null>(null);
  const dayKeys = days.map(toYMD);

  const place = (g: Gesture) => {
    const first = scrollRef.current?.querySelector<HTMLElement>(".wk-col");
    if (!first) return null;
    const box = first.getBoundingClientRect();
    return dropTarget({
      x: g.x - box.left,
      y: g.y - box.top,
      grabY: g.grabY,
      gridWidth: box.width * days.length,
      hourPx: HOUR_PX,
      days: dayKeys,
    });
  };

  const showGhost = (g: Gesture) => {
    const at = place(g);
    if (at) setGhost({ taskId: g.task.id, ...at, color: colorFor(g.task) });
  };

  const endGesture = () => {
    const g = gesture.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    gesture.current = null;
    setGhost(null);
  };

  const activate = (g: Gesture) => {
    g.active = true;
    // A browser may refuse capture (the press already ended); the drag still works.
    try {
      g.target.setPointerCapture(g.pointerId);
    } catch {}
    showGhost(g);
    // Near the top or bottom edge, the grid scrolls under a block held still.
    const tick = () => {
      if (gesture.current !== g) return;
      const el = scrollRef.current;
      if (el) {
        const box = el.getBoundingClientRect();
        const delta = g.y < box.top + EDGE_SCROLL_PX ? -8 : g.y > box.bottom - EDGE_SCROLL_PX ? 8 : 0;
        if (delta) {
          el.scrollTop += delta;
          showGhost(g);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const dragProps = (task: Task, fromYmd: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || gesture.current) return;
      const touch = e.pointerType !== "mouse";
      const g: Gesture = {
        task,
        pointerId: e.pointerId,
        touch,
        target: e.currentTarget,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        grabY: e.clientY - e.currentTarget.getBoundingClientRect().top,
        active: false,
      };
      gesture.current = g;
      if (touch) g.timer = window.setTimeout(() => activate(g), LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      g.x = e.clientX;
      g.y = e.clientY;
      if (g.active) {
        showGhost(g);
        return;
      }
      const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
      if (g.touch && moved > TOUCH_SLOP_PX) endGesture();
      else if (!g.touch && moved > DRAG_THRESHOLD_PX) activate(g);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      if (g.active) {
        suppressClick.current = true;
        const at = place(g);
        const time = at ? minutesToTime(at.minutes) : null;
        if (at && time && (at.ymd !== fromYmd || time !== task.time)) onMoveTask?.(task, at.ymd, time);
      }
      endGesture();
    },
    onPointerCancel: endGesture,
    onContextMenu: (e: React.MouseEvent) => {
      // A long press is a drag here, not a request for the phone's menu.
      if (gesture.current?.touch) e.preventDefault();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!e.altKey) return;
      const to = nudge(dayKeys.indexOf(fromYmd), minutesOf(task.time), e.key, dayKeys.length);
      if (!to) return;
      e.preventDefault();
      onMoveTask?.(task, dayKeys[to.dayIndex], minutesToTime(to.minutes));
    },
  });

  // Escape drops the block back where it was.
  const dragging = ghost !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      suppressClick.current = true;
      endGesture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragging]);

  // Once a long press has picked a block up, the finger moves it, not the page.
  // React's touch handlers are passive, so this one is attached by hand.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  // The "now" line moves with the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Open on the part of the day that matters: an hour before now, or the
  // morning when viewing another week.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasToday = days.some((d) => toYMD(d) === todayYmd);
    const hour = hasToday ? Math.max(START_HOUR, new Date().getHours() - 1) : 8;
    el.scrollTop = (hour - START_HOUR) * HOUR_PX;
    // Only when the week changes, not on every task edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toYMD(days[0])]);

  const hasDue = days.some((d) => tasksForDay(toYMD(d)).some(isDue));
  const hours = useMemo(() => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i), []);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMins - START_HOUR * 60) / 60) * HOUR_PX;
  const overlap = ghost ? overlapAt(tasksForDay(ghost.ymd).filter((t) => !isDue(t)), ghost.taskId, ghost.minutes, BLOCK_MIN) : null;

  return (
    <div className={`wk${dragging ? " is-dragging" : ""}`}>
      <div className="wk-head">
        <span className="wk-gutter" aria-hidden="true" />
        {days.map((d) => {
          const ymd = toYMD(d);
          const isToday = ymd === todayYmd;
          return (
            <button key={ymd} type="button" className={`wk-day-head${isToday ? " is-today" : ""}`} onClick={() => onOpenDay(ymd)}>
              <span className="wk-dow">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="wk-date">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Due dates (Canvas, 11:59 PM) aren't times anything happens: like an
          all-day row, they sit above the grid instead of at its very bottom. */}
      {hasDue && (
        <div className="wk-due">
          <span className="wk-gutter wk-due-label">Due</span>
          {days.map((d) => {
            const ymd = toYMD(d);
            const due = tasksForDay(ymd).filter(isDue);
            return (
              <div key={ymd} className="wk-due-col">
                {due.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`wk-due-item${t.completed ? " is-done" : ""}${isCanvasCleared(t, todayYmd) ? " is-cleared" : ""}${t.source === "canvas" ? " is-fixed" : ""}`}
                    style={{ "--block": colorFor(t) } as React.CSSProperties}
                    onClick={() => (onOpenTask ? onOpenTask(ymd, t.id) : onOpenDay(ymd))}
                    aria-label={t.title}
                    data-task-tip={t.id}
                  >
                    <span className="wk-due-title">{labelFor ? labelFor(t) : <TaskTitle task={t} chip={false} />}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="wk-scroll" ref={scrollRef}>
        <div className="wk-body" style={{ height: hours.length * HOUR_PX }}>
          <div className="wk-hours" aria-hidden="true">
            {hours.map((h) => (
              <span key={h} className="wk-hour" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                {h === START_HOUR ? "" : label(h)}
              </span>
            ))}
          </div>

          {days.map((d, col) => {
            const ymd = toYMD(d);
            const isToday = ymd === todayYmd;
            const placed = lanes(tasksForDay(ymd).filter((t) => !isDue(t)));
            return (
              <div key={ymd} className={`wk-col${isToday ? " is-today" : ""}`}>
                {/* Each hour is a slot: clicking empty time adds a task there. */}
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="wk-slot"
                    style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                    onClick={() => onAddAt(ymd, `${String(h).padStart(2, "0")}:00`)}
                    aria-label={`Add a task on ${d.toDateString()} at ${label(h)}`}
                    tabIndex={-1}
                  />
                ))}

                {placed.map(({ task, lane, of }, i) => {
                  const start = Math.max(minutesOf(task.time), START_HOUR * 60);
                  const top = ((start - START_HOUR * 60) / 60) * HOUR_PX;
                  const color = colorFor(task);
                  const movable = !!onMoveTask && canDragTask(task);
                  const held = ghost?.taskId === task.id;
                  return (
                    <m.button
                      key={task.id}
                      type="button"
                      className={`wk-block${task.completed ? " is-done" : ""}${isCanvasCleared(task, todayYmd) ? " is-cleared" : ""}${movable ? " is-movable" : " is-fixed"}${held ? " is-held" : ""}`}
                      {...(movable ? dragProps(task, ymd) : {})}
                      style={
                        {
                          top: top + 1,
                          height: (BLOCK_MIN / 60) * HOUR_PX - 3,
                          left: `calc(${(lane / of) * 100}% + 3px)`,
                          width: `calc(${100 / of}% - 6px)`,
                          "--block": color,
                        } as React.CSSProperties
                      }
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        if (onOpenTask) onOpenTask(ymd, task.id);
                        else onOpenDay(ymd);
                      }}
                      // Seen every time a week is opened: a quick fade, no stagger
                      // or bounce to wait through.
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      aria-label={`${time12(task.time)} ${task.title}`}
                      data-task-tip={dragging ? undefined : task.id}
                    >
                      <span className="wk-block-title">{labelFor ? labelFor(task) : <TaskTitle task={task} chip={false} />}</span>
                      <span className="wk-block-time">{time12(task.time)}</span>
                    </m.button>
                  );
                })}

                {ghost?.ymd === ymd && (
                  <div
                    className="wk-ghost"
                    aria-hidden="true"
                    style={{ top: (ghost.minutes / 60) * HOUR_PX + 1, height: (BLOCK_MIN / 60) * HOUR_PX - 3, "--block": ghost.color } as React.CSSProperties}
                  >
                    <span className="wk-ghost-time">{time12(minutesToTime(ghost.minutes))}</span>
                    {overlap && <span className="wk-ghost-warn">Overlaps {overlap.title}</span>}
                  </div>
                )}

                {isToday && nowMins >= START_HOUR * 60 && (
                  <span className="wk-now" style={{ top: nowTop }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
