"use client";

// /projects/<id> (and /dev/app/project with sample data). One project: its
// goal, its steps by week, its pace, and Tangent to add to it or help with any
// step (docs/design/WIREFRAMES.md §3). Steps added from the
// project chat join this project and are spaced around the student's week.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, MessageSquareText, Plus } from "lucide-react";
import { useAppState, useUserTimezone } from "@/components/AppStateProvider";
import { openTask } from "@/components/TaskDetail";
import { takeAsk } from "@/lib/ask-handoff";
import InlineAsk, { type InlineAskHandle } from "@/components/chat/InlineAsk";
import ColorPicker from "@/components/projects/ColorPicker";
import ProjectStats from "@/components/projects/ProjectStats";
import RoundReview from "@/components/projects/RoundReview";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import GroupHeader from "@/components/ui/GroupHeader";
import ProgressPace from "@/components/ui/ProgressPace";
import TaskRow from "@/components/ui/TaskRow";
import { joinProjectNotes, splitProjectNotes, type ProjectNotes } from "@/lib/project-notes";
import { paceOf, startsLabel, stepsByWeek, weekdayDate, weekSessions, type Pace, type WeekSession } from "@/lib/project-stats";
import { roundChip } from "@/lib/rounds";
import { rowPresence, spring } from "@/lib/motion";
import { planSeriesColor } from "@/lib/task-colors";
import { getUserToday } from "@/lib/time";
import type { Task } from "@/lib/types";
import "@/app/(app)/projects/projects.css";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** One sentence, whole numbers only (docs/design/TANGENT-STYLE.md §8 Progress / pace). */
function paceSentence(pace: Pace, week: WeekSession[], today: string): string {
  if (pace.remaining === 0) return "Every step is done.";
  if (pace.startsOn) return `${startsLabel(pace.startsOn, today)}.`;
  const doneThisWeek = week.filter((w) => w === "done").length;
  let line: string;
  if (pace.status !== "On track") {
    // Behind is measured over the last 7 days against what finishes on time,
    // so say those two numbers, not this week's dots.
    line = `${pace.status}: ${plural(pace.doneLast7, "step")} done in the last 7 days, ${pace.neededThisWeek} a week finishes on time.`;
  } else if (week.length > 0) {
    line = `On track: ${doneThisWeek} of ${plural(week.length, "step")} done this week.`;
  } else {
    line = pace.neededThisWeek > 0 ? `On track: ${plural(pace.neededThisWeek, "step")} to do this week.` : "On track: nothing due this week.";
  }
  if (pace.overdue > 0) line += ` ${pace.overdue} overdue.`;
  return line;
}

const DEADLINE_LABEL = /deadline|due/i;
const MAX_CHIPS = 5;

/** The brief as short chips: the deadline first, then what the student said,
 *  then the defaults. The full wording is in "How this was planned". */
function briefChips(notes: ProjectNotes, lastDate: string | null): { key: string; text: string; title?: string }[] {
  const chips: { key: string; text: string; title?: string }[] = [];
  const deadline = notes.known.find((k) => DEADLINE_LABEL.test(k.label));
  // Round 4 §3.6: a project planned in rounds shows its round, not an end date.
  if (notes.round) chips.push({ key: "round", text: roundChip(notes.round), title: "Tangent plans the next round from how this one goes" });
  if (deadline) chips.push({ key: "due", text: `Due ${deadline.value}`, title: deadline.label });
  else if (lastDate && !notes.round) chips.push({ key: "ends", text: `Ends ${weekdayDate(lastDate)}`, title: "Last step" });
  notes.known.forEach((k, i) => {
    if (k === deadline) return;
    // "5" alone says nothing; "5 hours per week" does.
    const text = /^\d+(\.\d+)?$/.test(k.value) && k.label ? `${k.value} ${k.label.toLowerCase()}` : k.value;
    chips.push({ key: `k${i}`, text, title: k.label || undefined });
  });
  notes.assumed.forEach((a, i) => chips.push({ key: `a${i}`, text: a, title: "Tangent assumed this" }));
  return chips.slice(0, MAX_CHIPS);
}

async function post(url: string, body: unknown): Promise<boolean> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return res.ok && data.ok !== false;
}

export default function ProjectView({ id }: { id: string }) {
  const router = useRouter();
  const { state, refresh } = useAppState();
  const today = getUserToday(useUserTimezone());
  const plan = state?.plans.find((p) => p.id === id) ?? null;
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [laterOpen, setLaterOpen] = useState<boolean | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  // Round 4 Phase 4: no chat panel. The project's ask box is on the page.
  const askRef = useRef<InlineAskHandle>(null);
  const loaded = !!state;

  // /projects/<id>?ask=1 asks what was handed over (⌘K, a Grill offer);
  // ?chat=1 (old links) just goes to the box.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") !== "1" && params.get("ask") !== "1") return;
    const asked = params.get("ask") === "1" ? takeAsk("ai") : null;
    window.setTimeout(() => (asked ? askRef.current?.ask(asked) : askRef.current?.focus()), 60);
    router.replace(`/projects/${encodeURIComponent(id)}`, { scroll: false });
  }, [id, loaded, router]);

  const weekStart = state?.user.weekStart ?? 0;
  // The description holds the goal and the planner's brief; only the goal is
  // edited here, and the brief lines are kept as they were on save.
  const notes = useMemo(() => splitProjectNotes(plan?.description), [plan?.description]);

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title);
    setGoal(notes.goal);
  }, [plan?.id, plan?.title, notes.goal]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const groups = useMemo(() => stepsByWeek(steps, today, weekStart), [steps, today, weekStart]);
  const week = useMemo(() => weekSessions(steps, today, weekStart), [steps, today, weekStart]);
  const pace = useMemo(() => paceOf(steps, today), [steps, today]);
  const lastDate = steps.reduce<string | null>((last, t) => (t.date && (!last || t.date > last) ? t.date : last), null);
  // Later starts folded while there's something sooner to look at.
  const laterShown = laterOpen ?? (groups.thisWeek.length === 0 && groups.nextWeek.length === 0);

  const save = useCallback(
    async (patch: { title?: string; description?: string }) => {
      if (!plan) return;
      if (patch.title !== undefined && (patch.title.trim() === plan.title || !patch.title.trim())) return;
      if (patch.description !== undefined && patch.description.trim() === plan.description.trim()) return;
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

  const color = planSeriesColor(plan);
  const chips = briefChips(notes, lastDate);
  const percent = steps.length === 0 ? 0 : Math.round((done.length / steps.length) * 100);
  const sections = [
    { id: "this-week", title: "This week", tasks: groups.thisWeek },
    { id: "next-week", title: "Next week", tasks: groups.nextWeek },
    { id: "later", title: "Later", tasks: groups.later },
  ].filter((g) => g.tasks.length > 0);

  const remove = async () => {
    setDeleting(true);
    setDeleteError(false);
    const ok = await post("/api/plans", { action: "delete", planId: plan.id, deleteTasks: true });
    if (!ok) {
      setDeleting(false);
      setDeleteError(true);
      return;
    }
    await refresh();
    router.push("/projects");
  };

  const row = (task: Task) => (
    <m.div key={task.id} layout="position" transition={spring.layout} {...rowPresence}>
      <TaskRow
        task={task}
        showDate
        kindColor={color}
        projectName={plan.title}
        onComplete={() => void toggle(task)}
        onOpen={() => openTask(task.id)}
        revealActions
        actions={
          <button type="button" className="ui-task-help" onClick={() => askRef.current?.focus(`About “${task.title}”: `)} aria-label={`Ask about ${task.title}`}>
            <MessageSquareText size={13} aria-hidden="true" />
            <span>Ask</span>
          </button>
        }
      />
    </m.div>
  );

  return (
    <div className="project-page" style={{ "--project-color": color } as React.CSSProperties}>
      <div className="project-topbar">
        <Link href="/projects" className="project-back"><ChevronLeft size={16} aria-hidden="true" /> Projects</Link>
        <Button size="sm" icon={<MessageSquareText size={15} strokeWidth={1.75} aria-hidden="true" />} onClick={() => askRef.current?.focus()}>
          Ask
        </Button>
      </div>

      <header className="project-head">
        <div className="project-title-row">
          <span
            className="project-pie"
            style={{ "--pie": `${percent}%` } as React.CSSProperties}
            role="img"
            aria-label={`${percent}% done`}
          />
          <input
            name="project-name"
            className="project-title-input"
            value={title}
            aria-label="Project name"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void save({ title })}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        {chips.length > 0 && (
          <ul className="project-chips" aria-label="About this project">
            {chips.map((c) => (
              <li key={c.key}>
                <Chip variant="meta" title={c.title ? `${c.title}: ${c.text}` : c.text}>{c.text}</Chip>
              </li>
            ))}
          </ul>
        )}
        <textarea
          name="project-goal"
          className="project-goal-input"
          value={goal}
          rows={1}
          placeholder="What's the goal? Tangent uses it for every step."
          aria-label="Project goal"
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => void save({ description: joinProjectNotes(goal, notes.briefLines) })}
        />
        {(notes.known.length > 0 || notes.assumed.length > 0) && (
          <details className="project-planned">
            <summary>How this was planned</summary>
            <Card variant="muted" as="div" className="project-planned-card">
              {notes.known.length > 0 && (
                <>
                  <h3>You said</h3>
                  <ul>
                    {notes.known.map((k, i) => (
                      <li key={i}>{k.label ? <><span>{k.label}:</span> {k.value}</> : k.value}</li>
                    ))}
                  </ul>
                </>
              )}
              {notes.assumed.length > 0 && (
                <>
                  <h3>Tangent assumed</h3>
                  <ul>
                    {notes.assumed.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  <p className="project-planned-note">Change any of it by asking below.</p>
                </>
              )}
            </Card>
          </details>
        )}
      </header>
      {notes.round && <RoundReview projectId={id} stepsKey={`${done.length}/${steps.length}`} onChanged={() => void refresh()} />}

      <div className="project-layout project-layout--steps">
        <div className="project-main">
          {open.length === 0 && (
            <p className="project-empty">Every step is done. Ask for more below, or call it finished.</p>
          )}
          {sections.map((g) => {
            const folds = g.id === "later" && sections.length > 1;
            const shown = !folds || laterShown;
            return (
              <section key={g.id} className="project-steps" aria-labelledby={`project-${g.id}`}>
                <GroupHeader
                  variant="time"
                  as="h2"
                  className="project-group-header"
                  title={<span id={`project-${g.id}`}>{g.title}</span>}
                  count={g.tasks.length}
                  collapsed={folds ? !shown : undefined}
                  onToggle={folds ? () => setLaterOpen(!shown) : undefined}
                  controls={folds ? `project-list-${g.id}` : undefined}
                />
                {shown && (
                  <div className="project-step-list" id={`project-list-${g.id}`}>
                    <AnimatePresence initial={false}>{g.tasks.map(row)}</AnimatePresence>
                  </div>
                )}
              </section>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="project-add"
            icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => askRef.current?.focus("Add a step: ")}
          >
            Add a step
          </Button>

          <InlineAsk
            ref={askRef}
            className="project-ask"
            scope={{ projectId: plan.id }}
            label={`Ask about ${plan.title}`}
            placeholder={`Ask about ${plan.title}, or ask for more steps…`}
          />

          {done.length > 0 && (
            <details className="project-done">
              <summary>
                Done <span>{done.length}</span>
              </summary>
              <div className="project-step-list">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} showDate kindColor={color} projectName={plan.title} onComplete={() => void toggle(task)} />
                ))}
              </div>
            </details>
          )}
        </div>

        <Card as="aside" className="project-pace-card" aria-label="Progress">
          <ProgressPace
            done={done.length}
            total={steps.length}
            week={pace.startsOn ? undefined : week}
            sentence={paceSentence(pace, week, today)}
          />
        </Card>

        <div className="project-extras">
          <ProjectStats tasks={steps} today={today} extrasOnly />
        </div>

        <div className="project-settings">
          <ColorPicker planId={plan.id} color={plan.color} onChanged={() => void refresh()} />
          {confirmDelete ? (
            <ConfirmPanel
              title={`Delete ${plan.title}?`}
              actionLabel="Delete"
              busyLabel="Deleting…"
              busy={deleting}
              onConfirm={() => void remove()}
              onCancel={() => {
                setConfirmDelete(false);
                setDeleteError(false);
              }}
            >
              <p>
                Delete {plan.title}
                {steps.length > 0 ? ` and its ${plural(steps.length, "step")}` : ""}? This can&apos;t be undone.
              </p>
              {deleteError && <p role="alert" className="project-delete-error">Couldn&apos;t delete the project. Try again.</p>}
            </ConfirmPanel>
          ) : (
            <Button variant="danger-quiet" size="sm" className="project-delete" onClick={() => setConfirmDelete(true)}>
              Delete project
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}
