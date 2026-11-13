"use client";

// Round 4 Phase 4.1: drag a task to another day in the month grid. A mouse
// picks it up after a few pixels; a finger after a long press (so a swipe still
// scrolls). The day under the pointer lights up; letting go moves the task to
// that day at the same time, through the same reschedule as the week grid, so
// the Undo toast and Recent changes can put it back. Escape cancels.
//
// Cells mark themselves with data-ymd. The keyboard way to move a task between
// days is the day panel's "Move to" date field (calendar/page.tsx).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import { canDragTask } from "@/lib/calendar-drag";

const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD_PX = 5;
const TOUCH_SLOP_PX = 8;

type Gesture = {
  task: Task;
  pointerId: number;
  touch: boolean;
  target: HTMLElement;
  startX: number;
  startY: number;
  active: boolean;
  timer?: number;
};

export type MonthDrag = { taskId: string; overYmd: string | null; x: number; y: number };

function dayAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const cell = el instanceof Element ? el.closest<HTMLElement>("[data-ymd]") : null;
  return cell?.dataset.ymd ?? null;
}

export function useMonthDrag(onMove: (task: Task, ymd: string) => void) {
  const gesture = useRef<Gesture | null>(null);
  /** The click that ends a drag must not also open the task or the day. */
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<MonthDrag | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const end = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    window.clearTimeout(g.timer);
    gesture.current = null;
    setDrag(null);
  }, []);

  const activate = (g: Gesture, x: number, y: number) => {
    g.active = true;
    try {
      g.target.setPointerCapture(g.pointerId);
    } catch {}
    setDrag({ taskId: g.task.id, overYmd: dayAt(x, y), x, y });
  };

  const dragProps = (task: Task) => {
    if (!canDragTask(task)) return {};
    return {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0 || gesture.current) return;
        const touch = e.pointerType !== "mouse";
        const x = e.clientX;
        const y = e.clientY;
        const g: Gesture = { task, pointerId: e.pointerId, touch, target: e.currentTarget, startX: x, startY: y, active: false };
        gesture.current = g;
        if (touch) g.timer = window.setTimeout(() => activate(g, x, y), LONG_PRESS_MS);
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g || g.pointerId !== e.pointerId) return;
        if (g.active) {
          setDrag({ taskId: task.id, overYmd: dayAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY });
          return;
        }
        const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
        if (g.touch && moved > TOUCH_SLOP_PX) end();
        else if (!g.touch && moved > DRAG_THRESHOLD_PX) activate(g, e.clientX, e.clientY);
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g || g.pointerId !== e.pointerId) return;
        if (g.active) {
          suppressClick.current = true;
          const to = dayAt(e.clientX, e.clientY);
          if (to && to !== task.date) onMoveRef.current(task, to);
        }
        end();
      },
      onPointerCancel: end,
      onContextMenu: (e: React.MouseEvent) => {
        // A long press is a drag here, not the phone's menu.
        if (gesture.current?.touch) e.preventDefault();
      },
    };
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      suppressClick.current = true;
      end();
    };
    // Once a long press has picked a task up, the finger moves it, not the page.
    const onTouchMove = (e: TouchEvent) => {
      if (gesture.current?.active) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [dragging, end]);

  /** True once, right after a drag ended: the caller skips its click. */
  const tookClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  return { drag, dragProps, tookClick };
}
