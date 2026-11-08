"use client";

// Home's view tabs: All / School / Projects / Personal. The choice is
// remembered on this device. lib/task-filters.ts decides which task is which.

import { useCallback, useEffect, useState } from "react";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { TASK_VIEWS, parseTaskView, type TaskView } from "@/lib/task-filters";

const VIEW_KEY = "tangent-today-view";

export function useTodayView(): [TaskView, (view: TaskView) => void] {
  const [view, setView] = useState<TaskView>("all");
  useEffect(() => {
    try {
      setView(parseTaskView(window.localStorage.getItem(VIEW_KEY)));
    } catch {}
  }, []);
  const choose = useCallback((next: TaskView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {}
  }, []);
  return [view, choose];
}

type Props = { view: TaskView; onChange: (view: TaskView) => void; controls: string };

export default function TodayFilter({ view, onChange, controls }: Props) {
  return (
    <SegmentedTabs
      className="today-views"
      label="Show"
      idPrefix="today-view"
      value={view}
      onChange={onChange}
      options={TASK_VIEWS.map((v) => ({ value: v.id, label: v.label, controls }))}
    />
  );
}
