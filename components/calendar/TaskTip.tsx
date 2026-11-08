"use client";

// Master fix Phase 5: one hover tooltip for every task on the calendar (week
// blocks, month chips, the day panel). Anything marked data-task-tip={task.id}
// gets it: the full title, when, the project with its color dot, and the
// calendar (School / No school). Mouse hover or keyboard focus; never touch.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { calendarGroupOf, CAL_SCHOOL } from "@/lib/calendars";
import { formatTime12 } from "@/lib/dates";
import type { Plan, Task } from "@/lib/types";
import "./task-tip.css";

type Props = {
  tasks: Task[];
  plans: Plan[];
  colorFor: (t: Task) => string;
};

type Tip = { id: string; x: number; y: number; below: boolean };

const DELAY_MS = 280;

function whenOf(t: Task): string {
  const day = new Date(`${t.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  // Canvas items and 11:59 PM are due dates, not times anything happens.
  if (t.source === "canvas" || t.time === "23:59") return `Due ${day}`;
  return t.time ? `${day} · ${formatTime12(t.time)}` : day;
}

export default function TaskTip({ tasks, plans, colorFor }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      setTip(null);
    };
    const show = (target: EventTarget | null) => {
      const el = target instanceof Element ? target.closest<HTMLElement>("[data-task-tip]") : null;
      window.clearTimeout(timer);
      if (!el) return setTip(null);
      const id = el.dataset.taskTip ?? "";
      timer = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.top < 110;
        setTip({ id, x: Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130), y: below ? r.bottom + 6 : r.top - 6, below });
      }, DELAY_MS);
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType === "mouse") show(e.target);
    };
    const focus = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(":focus-visible")) show(e.target);
      else hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", focus);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  const task = tip ? tasks.find((t) => t.id === tip.id) : undefined;
  if (!tip || !task || typeof document === "undefined") return null;
  const plan = task.planId ? plans.find((p) => p.id === task.planId) : undefined;
  const school = calendarGroupOf(task) === CAL_SCHOOL;

  return createPortal(
    <div
      className={`task-tip${tip.below ? " is-below" : ""}`}
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      <p className="task-tip-title">{task.title}</p>
      <p className="task-tip-when">{whenOf(task)}</p>
      <p className="task-tip-meta">
        <span className="task-tip-project">
          <span className="task-tip-dot" style={{ background: colorFor(task) }} aria-hidden="true" />
          {plan ? plan.title : "No project"}
        </span>
        <span className="task-tip-cal">{school ? "School" : "No school"}</span>
      </p>
    </div>,
    document.body
  );
}
