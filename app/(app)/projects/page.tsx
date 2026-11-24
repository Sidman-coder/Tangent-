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
import { splitProjectNotes } from "@/lib/project-notes";
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
    // School and Work have their own section, so they never sit in the grid.
    return (state?.plans ?? [])
      .filter((plan) => !plan.kind)
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
  // Round 5A Phase 3: School and Work are projects (plans.kind). Before the
  // migration runs there's no School plan, and Canvas alone still shows School.
  const schoolPlan = state?.plans.find((p) => p.kind === "school") ?? null;
  const workPlan = state?.plans.find((p) => p.kind === "work") ?? null;
  const schoolPlanTasks = useMemo(
    () => (schoolPlan ? (state?.tasks ?? []).filter((t) => t.planId === schoolPlan.id && t.source !== "canvas") : []),
    [state, schoolPlan]
  );
  const showSchool = Boolean(schoolPlan) || canvasConnected || schoolTasks.length > 0;

  const active = projects.filter((p) => p.next).sort((a, b) => (a.next!.date + a.next!.time).localeCompare(b.next!.date + b.next!.time));
  const finished = projects.filter((p) => !p.next);
  const showComposer = composing || (state !== null && projects.length === 0);

  return (
    <div className="projects-page">
      <PageHeader
        title="Projects"
        description="Bigger goals, broken into steps Tangent spaces out on your calendar."
        actions={
          <>
            {/* Tangents live inside Projects (the sidebar shows them too, from laptop width). */}
            <Link href="/tangents" className="projects-paths-link">
              Tangents
            </Link>
            {!showComposer && (
              <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setComposing(true)}>
                New project
              </Button>
            )}
          </>
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
            placeholder="Prep for my chem final on Dec 12…"
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
          {(showSchool || workPlan) && (
            <section className="school-section" aria-labelledby="areas-heading">
              <h2 id="areas-heading">School &amp; Work</h2>
              <div className="areas-grid">
                {showSchool && <SchoolCard tasks={[...schoolTasks, ...schoolPlanTasks]} today={today} canvasConnected={canvasConnected} />}
                {workPlan && <AreaCard plan={workPlan} tasks={(state?.tasks ?? []).filter((t) => t.planId === workPlan.id)} today={today} />}
              </div>
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

function SchoolCard({ tasks, today, canvasConnected }: { tasks: Task[]; today: string; canvasConnected: boolean }) {
  const courses = courseGroups(tasks.filter((t) => t.source === "canvas"), today);
  const deadline = nextDeadline(tasks, today);
  const due = dueThisWeek(tasks, today);
  return (
    <Link href="/projects/school" className="school-card">
      <div className="school-card-copy">
        <span className="area-card-name">School</span>
        <strong>{deadline ? `Next: ${splitCourse(deadline).title}` : "Nothing due right now"}</strong>
        {deadline || canvasConnected ? (
          <span>
            {deadline ? `${shortDate(deadline.date)} · ` : ""}
            {due} due this week · {courses.length} course{courses.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span>Add a test or assignment and it shows up here. Open School to add one.</span>
        )}
      </div>
      <MiniWorkload weeks={workloadByWeek(tasks, today)} />
    </Link>
  );
}

/** Work (and any later area): a project with no goal line or progress bar,
 *  just what's next. */
function AreaCard({ plan, tasks, today }: { plan: Plan; tasks: Task[]; today: string }) {
  const open = tasks.filter((t) => !t.completed).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time));
  const next = open.find((t) => !t.date || t.date >= today) ?? null;
  return (
    <Link href={`/projects/${plan.id}`} className="school-card" style={{ "--project-color": planSeriesColor(plan) } as React.CSSProperties}>
      <div className="school-card-copy">
        <span className="area-card-name">{plan.title}</span>
        <strong>{next ? `Next: ${next.title}` : "Nothing coming up"}</strong>
        <span>
          {next?.date ? `${shortDay(next.date, today)}${next.time ? ` · ${formatTime12(next.time)}` : ""} · ` : ""}
          {open.length} open
        </span>
      </div>
    </Link>
  );
}

function ProjectCard({ project, today }: { project: ProjectSummary; today: string }) {
  const { plan, steps, done, next } = project;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const overdue = Boolean(next && next.date && next.date < today);
  const goal = splitProjectNotes(plan.description).goal;
  return (
    <Link href={`/projects/${plan.id}`} className="project-card" style={{ "--project-color": planSeriesColor(plan) } as React.CSSProperties}>
      <div className="project-card-top">
        <span className="project-dot" aria-hidden="true" />
        <h3>{plan.title}</h3>
      </div>
      {/* Overnight 2 (3.4 live): the description also holds the planner's brief
          ("Brief — … Round — 2 · started …"); the card shows only the goal,
          like the project page does. */}
      {goal && <p className="project-card-goal">{goal}</p>}
      <div className="project-progress" aria-label={`${done} of ${steps.length} steps done`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="project-card-meta">
        {next ? (
          <>
            <span className="project-card-next">Next: {next.title}</span>
            <span className={overdue ? "project-card-when is-overdue" : "project-card-when"}>
              {overdue ? "Overdue · " : ""}
              {shortDay(next.date, today)}
              {next.time ? ` · ${formatTime12(next.time)}` : ""}
            </span>
          </>
        ) : steps.length === 0 ? (
          <span>No steps yet. Open it to plan the first ones.</span>
        ) : (
          <span>All {steps.length} steps done</span>
        )}
      </p>
    </Link>
  );
}
