"use client";

// Projects: the longer things a student is working toward. Each is a plan with
// a goal and steps; Tangent asks a few questions, lays the steps out around the
// student's week (the spacing brain), and helps with each one.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { planSeriesColor } from "@/lib/task-colors";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import AddFlow from "@/components/add/AddFlow";
import { MiniWorkload } from "@/components/projects/ProjectStats";
import { takeAsk } from "@/lib/ask-handoff";
import { withoutClearedCanvas } from "@/lib/canvas-clear";
import { splitCourse } from "@/lib/course";
import { formatTime12 } from "@/lib/dates";
import { courseGroups, dueThisWeek, nextDeadline, shortDate, workloadByWeek } from "@/lib/project-stats";
import { getUserToday } from "@/lib/time";
import type { Plan, Task } from "@/lib/types";
import "./projects.css";

type ProjectSummary = { plan: Plan; steps: Task[]; done: number; next: Task | null };

function shortDay(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const PROJECT_EXAMPLES = [
  "Prep for my AP Chem final",
  "Start a robotics club at school",
  "Write my college essay drafts",
  "Get ready for the SAT in March",
];

export default function ProjectsPage() {
  const router = useRouter();
  const { state, loading, refresh } = useAppState();
  const tz = useUserTimezone();
  const today = getUserToday(tz);
  const [composing, setComposing] = useState(false);
  // An example tapped from the empty state, dropped into the Add box.
  const [example, setExample] = useState<string | null>(null);
  // "Tell Tangent" (Cmd-K) routed a multi-week effort here: start it.
  const [handed, setHanded] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("start") !== "1") return;
    const text = takeAsk("project");
    router.replace("/projects");
    if (text) {
      setHanded(text);
      setComposing(true);
    }
  }, [router]);

  const projects = useMemo<ProjectSummary[]>(() => {
    const tasks = state?.tasks ?? [];
    return (state?.plans ?? [])
      .map((plan) => {
        const steps = tasks.filter((t) => t.planId === plan.id);
        const open = steps.filter((t) => !t.completed).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        return { plan, steps, done: steps.length - open.length, next: open.find((t) => t.date >= today) ?? open[0] ?? null };
      })
      .filter((p) => p.steps.length > 0 || p.plan.taskCount === 0);
  }, [state, today]);

  // School is there once Canvas is connected, even before anything's due.
  const [canvasConnected, setCanvasConnected] = useState(false);
  useEffect(() => {
    void fetch("/api/canvas/status")
      .then((res) => res.json())
      .then((data: { ok?: boolean; feed?: unknown }) => setCanvasConnected(Boolean(data.ok && data.feed)))
      .catch(() => {});
  }, []);
  const schoolTasks = useMemo(
    () => withoutClearedCanvas((state?.tasks ?? []).filter((t) => t.source === "canvas"), today),
    [state, today]
  );
  const showSchool = canvasConnected || schoolTasks.length > 0;

  const active = projects.filter((p) => p.next).sort((a, b) => (a.next!.date + a.next!.time).localeCompare(b.next!.date + b.next!.time));
  const finished = projects.filter((p) => !p.next);
  const showComposer = composing || (state !== null && projects.length === 0);

  return (
    <div className="projects-page">
      <PageHeader
        title="Projects"
        description="Bigger goals, broken into steps Tangent spaces out on your calendar."
        actions={
          !showComposer && (
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setComposing(true)}>
              New project
            </Button>
          )
        }
      />

      {showComposer && (
        <section className="projects-new" aria-label="Start a project">
          <h2>What are you working toward?</h2>
          <p>Say it or type it. Tangent asks a few questions, then lays the steps out around your week.</p>
          <AddFlow
            key={example ?? "blank"}
            variant="hero"
            defaultDest="project"
            placeholder="Prep for my chem final on Dec 12, start a robotics club…"
            autoFocus={Boolean(example) || (composing && !handed)}
            initialText={example ?? handed ?? ""}
          />
          {projects.length === 0 && (
            <div className="projects-examples" aria-label="Examples">
              <span>Try one</span>
              {PROJECT_EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="tg-chip" onClick={() => setExample(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
          {composing && projects.length > 0 && (
            <button type="button" className="projects-new-cancel" onClick={() => setComposing(false)}>
              Cancel
            </button>
          )}
        </section>
      )}

      {loading && !state ? (
        <div className="projects-grid" aria-busy="true">
          <div className="project-card is-loading" />
          <div className="project-card is-loading" />
        </div>
      ) : (
        <>
          {showSchool && (
            <section className="school-section" aria-labelledby="school-heading">
              <h2 id="school-heading">School</h2>
              <SchoolCard tasks={schoolTasks} today={today} />
            </section>
          )}
          {active.length > 0 && (
            <div className="projects-grid">
              {active.map((p) => (
                <ProjectCard key={p.plan.id} project={p} today={today} />
              ))}
            </div>
          )}
          {finished.length > 0 && (
            <section className="projects-finished" aria-label="Finished projects">
              <h2>Finished</h2>
              <div className="projects-grid">
                {finished.map((p) => (
                  <ProjectCard key={p.plan.id} project={p} today={today} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SchoolCard({ tasks, today }: { tasks: Task[]; today: string }) {
  const courses = courseGroups(tasks, today);
  const deadline = nextDeadline(tasks, today);
  const due = dueThisWeek(tasks, today);
  return (
    <Link href="/projects/school" className="school-card">
      <div className="school-card-copy">
        <strong>{deadline ? `Next: ${splitCourse(deadline).title}` : "Nothing due from Canvas"}</strong>
        <span>
          {deadline ? `${shortDate(deadline.date)} · ` : ""}
          {due} due this week · {courses.length} course{courses.length === 1 ? "" : "s"}
        </span>
      </div>
      <MiniWorkload weeks={workloadByWeek(tasks, today)} />
    </Link>
  );
}

function ProjectCard({ project, today }: { project: ProjectSummary; today: string }) {
  const { plan, steps, done, next } = project;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <Link href={`/projects/${plan.id}`} className="project-card" style={{ "--project-color": planSeriesColor(plan) } as React.CSSProperties}>
      <div className="project-card-top">
        <span className="project-dot" aria-hidden="true" />
        <h3>{plan.title}</h3>
      </div>
      {plan.description && <p className="project-card-goal">{plan.description}</p>}
      <div className="project-progress" aria-label={`${done} of ${steps.length} steps done`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="project-card-meta">
        {next ? (
          <>
            <span className="project-card-next">Next: {next.title}</span>
            <span>
              {shortDay(next.date, today)}
              {next.time ? ` · ${formatTime12(next.time)}` : ""}
            </span>
          </>
        ) : (
          <span>All {steps.length} steps done</span>
        )}
      </p>
    </Link>
  );
}
