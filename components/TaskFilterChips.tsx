"use client";

// Day and time-of-day chips above the to-do list. Each surface remembers its
// own choice in this browser (lib/task-filters.ts has the rules).

import { useCallback, useEffect, useState } from "react";
import { DAY_FILTERS, TIME_FILTERS, parseTaskFilter, type TaskFilter } from "@/lib/task-filters";

export function useTaskFilter(surface: "today" | "capture", fallback: TaskFilter) {
  const key = `tangent-task-filter-${surface}`;
  const [filter, setState] = useState(fallback);
  useEffect(() => {
    try {
      setState(parseTaskFilter(localStorage.getItem(key), fallback));
    } catch {
      /* storage blocked: the default it is */
    }
    // The fallback is a constant per surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setFilter = useCallback(
    (next: TaskFilter) => {
      setState(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage blocked: it still applies until reload */
      }
    },
    [key]
  );
  return [filter, setFilter] as const;
}

export default function TaskFilterChips({ filter, onChange }: { filter: TaskFilter; onChange: (next: TaskFilter) => void }) {
  return (
    <div className="task-filters">
      <div className="task-filter-row" role="group" aria-label="Filter by day">
        {DAY_FILTERS.map(({ id, label }) => (
          <button key={id} type="button" className="task-filter-chip" aria-pressed={filter.day === id} onClick={() => onChange({ ...filter, day: id })}>
            {label}
          </button>
        ))}
      </div>
      <div className="task-filter-row" role="group" aria-label="Filter by time of day">
        {TIME_FILTERS.map(({ id, label }) => (
          <button key={id} type="button" className="task-filter-chip" aria-pressed={filter.time === id} onClick={() => onChange({ ...filter, time: id })}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
