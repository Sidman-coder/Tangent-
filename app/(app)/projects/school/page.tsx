"use client";

// School: everything Canvas sent, as one project. Stats, then assignments by
// course. A static route, so it wins over /projects/[id].

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import ProjectStats from "@/components/projects/ProjectStats";
import { openTask } from "@/components/TaskDetail";
import TaskRow from "@/components/ui/TaskRow";
import { withoutClearedCanvas } from "@/lib/canvas-clear";
import { courseGroups } from "@/lib/project-stats";
import { taskColor } from "@/lib/task-colors";
import { getUserToday } from "@/lib/time";
import type { Task } from "@/lib/types";
import "../projects.css";

export default function SchoolPage() {
  const { state, refresh } = useAppState();
  const tz = useUserTimezone();
  const today = getUserToday(tz);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const tasks = useMemo(
    () =>
      withoutClearedCanvas((state?.tasks ?? []).filter((t) => t.source === "canvas"), today).map((t) =>
        t.id in overrides ? { ...t, completed: overrides[t.id] } : t
      ),
    [state, today, overrides]
  );
  const courses = useMemo(() => courseGroups(tasks, today), [tasks, today]);

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
      <Link href="/projects" className="project-back">
        <ChevronLeft size={16} aria-hidden="true" /> Projects
      </Link>
      <header className="project-head">
        <h1 className="project-title-input">School</h1>
      </header>
      {tasks.length === 0 ? (
        <p className="project-empty">Nothing from Canvas right now. New assignments show up here after the next sync.</p>
      ) : (
        <div className="project-layout">
          <div className="project-main">
            {courses.map((c) => (
              <section key={c.course} className="school-course" aria-label={c.course}>
                <div className="school-course-head">
                  <h2>{c.course}</h2>
                  <span>{c.dueThisWeek} due this week</span>
                </div>
                <div className="project-step-list">
                  {c.open.map((task) => (
                    <TaskRow key={task.id} task={task} showDate kindColor={taskColor(task)} onComplete={() => void toggle(task)} onOpen={() => openTask(task.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="project-side">
            <ProjectStats tasks={tasks} today={today} school />
          </aside>
        </div>
      )}
    </div>
  );
}
