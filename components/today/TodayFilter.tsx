"use client";

// The filter chips, behind one small button beside Today's greeting. A dot on
// the button says a filter is on.

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import TaskFilterChips from "@/components/TaskFilterChips";
import type { TaskFilter } from "@/lib/task-filters";

type Props = { filter: TaskFilter; onChange: (filter: TaskFilter) => void; active: boolean };

export default function TodayFilter({ filter, onChange, active }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="today-filter" ref={root}>
      <button
        ref={button}
        type="button"
        className="today-filter-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={active ? "Filter, a filter is on" : "Filter"}
        title="Filter"
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {active && <span className="today-filter-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="today-filter-pop" role="dialog" aria-label="Filter your to-do list">
          <TaskFilterChips filter={filter} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
