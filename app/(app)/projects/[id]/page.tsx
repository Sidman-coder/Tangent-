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
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { openTask } from "@/components/TaskDetail";
import { takeAsk } from "@/lib/ask-handoff";
import ChatSheet from "@/components/chat/ChatSheet";
import { openTaskChat } from "@/components/chat/TaskChatSheet";
import ColorPicker from "@/components/projects/ColorPicker";
import ProjectStats from "@/components/projects/ProjectStats";
import TaskRow from "@/components/ui/TaskRow";
import { rowPresence, spring } from "@/lib/motion";
import { planSeriesColor } from "@/lib/task-colors";
import { getUserToday } from "@/lib/time";
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
  const today = getUserToday(useUserTimezone());
  const plan = state?.plans.find((p) => p.id === id) ?? null;
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [askOnOpen, setAskOnOpen] = useState<string | null>(null);

  // /projects/<id>?chat=1 opens the project's chat (the library, Grill, old
  // links); &ask=1 also asks what Cmd-K handed over.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") !== "1") return;
    if (params.get("ask") === "1") setAskOnOpen(takeAsk("ai"));
    setChatOpen(true);
    router.replace(`/projects/${encodeURIComponent(id)}`, { scroll: false });
  }, [id, router]);

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
  if (!plan) {
    return (
      <div className="project-page" aria-busy={state ? undefined : "true"}>
        {state ? (
          <p className="project-empty" role="status">
            This project isn&apos;t here. It may have been deleted. <Link href="/projects">Back to Projects</Link>
          </p>
        ) : (
          <p className="project-empty" role="status">Loading project…</p>
        )}
      </div>
    );
  }

  return (
    <div className="project-page" style={{ "--project-color": planSeriesColor(plan) } as React.CSSProperties}>
      <Link href="/projects" className="project-back"><ChevronLeft size={16} aria-hidden="true" /> Projects</Link>

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
      </header>

      <div className="project-layout">
        <div className="project-main">

      <section className="project-steps" aria-labelledby="project-next">
        <h2 id="project-next">{open.length > 0 ? "Up next" : "All done"}</h2>
        {open.length === 0 && <p className="project-empty">Every step is done. Add more from Today or the project chat, or call it finished.</p>}
        <div className="project-step-list">
          <AnimatePresence initial={false}>
            {open.map((task) => (
              <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence}>
                <TaskRow
                  task={task}
                  showDate
                  kindColor={planSeriesColor(plan)}
                  onComplete={() => void toggle(task)}
                  onOpen={() => openTask(task.id)}
                  actions={
                    <button type="button" className="ui-task-help" onClick={() => openTaskChat(task.id)} aria-label={`Ask about ${task.title}`}>
                      <MessageSquareText size={13} aria-hidden="true" />
                      <span>Ask</span>
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
              <TaskRow key={task.id} task={task} showDate kindColor={planSeriesColor(plan)} onComplete={() => void toggle(task)} />
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
                setDeleteError(false);
                const ok = await post("/api/plans", { action: "delete", planId: plan.id, deleteTasks: true });
                if (!ok) {
                  setDeleteError(true);
                  return;
                }
                await refresh();
                router.push("/projects");
              }}
            >
              Delete
            </button>
            <button type="button" className="project-delete-no" onClick={() => { setConfirmDelete(false); setDeleteError(false); }}>
              Keep it
            </button>
            {deleteError && <p role="alert">Couldn&apos;t delete the project. Try again.</p>}
          </div>
        ) : (
          <button type="button" className="project-delete" onClick={() => setConfirmDelete(true)}>
            Delete project
          </button>
        )}
      </footer>

        </div>
        <aside className="project-side">
          <button type="button" className="project-ask-link" onClick={() => setChatOpen(true)} aria-haspopup="dialog">
            <MessageSquareText size={15} aria-hidden="true" />
            <span>Ask about this</span>
          </button>
          <ChatSheet
            open={chatOpen}
            scope={{ type: "project", projectId: plan.id }}
            askOnOpen={askOnOpen}
            label={`Chat about ${plan.title}`}
            onClose={() => {
              setChatOpen(false);
              setAskOnOpen(null);
            }}
          />
          <ColorPicker planId={plan.id} color={plan.color} onChanged={() => void refresh()} />
          <ProjectStats tasks={steps} today={today} />
        </aside>
      </div>

    </div>
  );
}
