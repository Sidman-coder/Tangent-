"use client";

// Projects: the longer things a student is working toward. Each is a plan with
// a goal and steps; Tangent asks a few questions, lays the steps out around the
// student's week (the spacing brain), and helps with each one.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import AddFlow from "@/components/add/AddFlow";
import { takeAsk } from "@/lib/ask-handoff";
import { formatTime12 } from "@/lib/dates";
import { getUserToday } from "@/lib/time";
import type { Plan, Task } from "@/lib/types";
import "./projects.css";

type ProjectSummary = { plan: Plan; steps: Task[]; done: number; next: Task | null };

function shortDay(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ProjectsPage() {
  const router = useRouter();
  const { state, loading, refresh } = useAppState();
  const tz = useUserTimezone();
  const today = getUserToday(tz);
  const [composing, setComposing] = useState(false);
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
          <AddFlow variant="hero" defaultDest="project" autoFocus={composing && !handed} initialText={handed ?? ""} />
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

function ProjectCard({ project, today }: { project: ProjectSummary; today: string }) {
  const { plan, steps, done, next } = project;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <Link href={`/projects/${plan.id}`} className="project-card" style={{ "--project-color": plan.color } as React.CSSProperties}>
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
