"use client";

// Round 5A Phase 3: "All tasks", linked from /capture. Every open task, past
// /capture's two-week window: Past due, Today, Upcoming, No date.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { openTask } from "@/components/TaskDetail";
import TaskRow from "@/components/ui/TaskRow";
import { allTasksGroups } from "@/lib/capture-list";
import { seriesColor, taskSeries } from "@/lib/task-colors";
import { getUserToday } from "@/lib/time";
import type { Task } from "@/lib/types";
import "../projects/projects.css";

export default function AllTasksPage() {
  const { state, refresh } = useAppState();
  const tz = useUserTimezone();
  const today = getUserToday(tz);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // Grouped from the stored tasks, so a just-ticked row stays in place (shown
  // ticked through `overrides`) until the refresh lands.
  const groups = useMemo(() => allTasksGroups(state?.tasks ?? [], today), [state, today]);

  const toggle = async (task: Task) => {
    const completed = !task.completed;
    setOverrides((o) => ({ ...o, [task.id]: completed }));
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_task", id: task.id, completed }),
      });
      await refresh();
    } finally {
      setOverrides((o) => {
        const next = { ...o };
        delete next[task.id];
        return next;
      });
    }
  };

  if (!state) return <div className="project-page" aria-busy="true" />;

  return (
    <div className="project-page">
      <Link href="/capture" className="project-back">
        <ChevronLeft size={16} aria-hidden="true" /> To do
      </Link>
      <header className="project-head">
        <h1 className="project-title-input">All tasks</h1>
      </header>
      {groups.length === 0 ? (
        <p className="project-empty">Nothing open. Add something from To do.</p>
      ) : (
        <div className="project-main">
          {groups.map((g) => (
            <section key={g.id} className="school-course" aria-label={g.label}>
              <div className="school-course-head">
                <h2>{g.label}</h2>
                <span>{g.tasks.length}</span>
              </div>
              <div className="project-step-list">
                {g.tasks.map((task) => {
                  const shown = task.id in overrides ? { ...task, completed: overrides[task.id] } : task;
                  return (
                    <TaskRow
                      key={task.id}
                      task={shown}
                      showDate={g.id !== "today"}
                      kindColor={seriesColor(taskSeries(task, state.plans))}
                      onComplete={() => void toggle(shown)}
                      onOpen={() => openTask(task.id)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
