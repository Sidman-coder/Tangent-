"use client";

// One project: its goal, its steps on the calendar, and Tangent to add to it
// or help with any step. Steps added here join this project and are spaced
// around the student's week by the spacing brain.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, MessageSquareText } from "lucide-react";
import { useAppState } from "@/components/AppStateProvider";
import ProjectChat from "@/components/projects/ProjectChat";
import ProjectPath from "@/components/projects/ProjectPath";
import { openTask } from "@/components/TaskDetail";
import TaskChatModal from "@/components/TaskChatModal";
import TaskRow from "@/components/ui/TaskRow";
import { rowPresence, spring } from "@/lib/motion";
import { taskColor } from "@/lib/task-colors";
import type { Task } from "@/lib/types";
import "../projects.css";

async function post(url: string, body: unknown): Promise<boolean> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return res.ok && data.ok !== false;
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, refresh } = useAppState();
  const plan = state?.plans.find((p) => p.id === id) ?? null;
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [helpTask, setHelpTask] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title);
    setGoal(plan.description);
  }, [plan?.id, plan?.title, plan?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(
    () =>
      (state?.tasks ?? [])
        .filter((t) => t.planId === id)
        .map((t) => (t.id in overrides ? { ...t, completed: overrides[t.id] } : t))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [state, id, overrides]
  );
  const open = steps.filter((t) => !t.completed);
  const done = steps.filter((t) => t.completed);
  const pct = steps.length ? Math.round((done.length / steps.length) * 100) : 0;

  const save = useCallback(
    async (patch: { title?: string; description?: string }) => {
      if (!plan) return;
      if (patch.title !== undefined && (patch.title.trim() === plan.title || !patch.title.trim())) return;
      if (patch.description !== undefined && patch.description.trim() === plan.description) return;
      await post("/api/plans", { action: "update", planId: plan.id, ...patch });
      void refresh();
    },
    [plan, refresh]
  );

  const toggle = async (task: Task) => {
    const next = !task.completed;
    setOverrides((o) => ({ ...o, [task.id]: next }));
    const ok = await post("/api/tasks", { action: "update_task", id: task.id, completed: next });
    if (!ok) setOverrides((o) => ({ ...o, [task.id]: task.completed }));
    await refresh();
    setOverrides((o) => {
      const { [task.id]: _drop, ...rest } = o;
      return rest;
    });
  };

  if (state && !plan) {
    return (
      <div className="project-page">
        <Link href="/projects" className="project-back"><ChevronLeft size={16} aria-hidden="true" /> Projects</Link>
        <p className="project-missing">This project is gone.</p>
      </div>
    );
  }
  if (!plan) return <div className="project-page" aria-busy="true" />;

  return (
    <div className="project-page" style={{ "--project-color": plan.color } as React.CSSProperties}>
      <Link href="/projects" className="project-back"><ChevronLeft size={16} aria-hidden="true" /> Projects</Link>



      <div className="project-layout">
        <div className="project-main">
        <header className="project-head">
          <input
            className="project-title-input"
            value={title}
            aria-label="Project name"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void save({ title })}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <textarea
            className="project-goal-input"
            value={goal}
            rows={2}
            placeholder="What's the goal? Tangent uses it for every step."
            aria-label="Project goal"
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => void save({ description: goal })}
          />
          <div className="project-head-progress">
            <div className="project-progress" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
            <span>
              {done.length} of {steps.length} done
            </span>
          </div>
          {plan && <ProjectPath plan={plan} steps={steps} />}
        </header>

      <section className="project-steps" aria-labelledby="project-next">
        <h2 id="project-next">{open.length > 0 ? "Up next" : "All done"}</h2>
        {open.length === 0 && <p className="project-empty">Every step is done. Add more above, or call it finished.</p>}
        <div className="project-step-list">
          <AnimatePresence initial={false}>
            {open.map((task) => (
              <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence}>
                <TaskRow
                  task={task}
                  showDate
                  kindColor={taskColor(task)}
                  onComplete={() => void toggle(task)}
                  onOpen={() => openTask(task.id)}
                  actions={
                    <button type="button" className="ui-task-help" onClick={() => setHelpTask(task)} aria-label={`Get help with ${task.title}`}>
                      <MessageSquareText size={13} aria-hidden="true" />
                      <span>Help</span>
                    </button>
                  }
                />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {done.length > 0 && (
        <details className="project-done">
          <summary>
            Done <span>{done.length}</span>
          </summary>
          <div className="project-step-list">
            {done.map((task) => (
              <TaskRow key={task.id} task={task} showDate kindColor={taskColor(task)} onComplete={() => void toggle(task)} />
            ))}
          </div>
        </details>
      )}

      <footer className="project-foot">
        {confirmDelete ? (
          <div className="project-delete-confirm" role="alertdialog" aria-label="Delete project">
            <span>
              Delete this project{open.length > 0 ? ` and its ${open.length} open step${open.length === 1 ? "" : "s"}` : ""}? This can&apos;t be undone.
            </span>
            <button
              type="button"
              className="project-delete-yes"
              onClick={async () => {
                await post("/api/plans", { action: "delete", planId: plan.id, deleteTasks: true });
                await refresh();
                router.push("/projects");
              }}
            >
              Delete
            </button>
            <button type="button" className="project-delete-no" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="project-delete" onClick={() => setConfirmDelete(true)}>
            Delete project
          </button>
        )}
      </footer>

        </div>
        <aside className="project-side">
          <ProjectChat projectId={plan.id} projectTitle={plan.title} onChanged={() => void refresh()} />
        </aside>
      </div>

      {helpTask && <TaskChatModal task={helpTask} onClose={() => setHelpTask(null)} />}
    </div>
  );
}
