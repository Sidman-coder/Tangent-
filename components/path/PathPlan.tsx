"use client";

// A path as a plan you can read and act on (the default view; the circle map
// is a toggle). Top to bottom:
//   1. Your next step: the one thing to do for this goal now.
//   2. What you already do: each activity on the path, what Tangent knows
//      about it (or that it doesn't yet), and the moves that branch off it:
//      suggested ones to keep or pass on, kept ones to schedule and finish.
// Same data and actions as the map (app/api/path); nothing here is new on
// the server.

import { useMemo, useState } from "react";
import { Check, CornerDownRight, Plus, Sparkles, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Path, PathNode, PathNodeSchedule } from "@/lib/types";
import { splitNodeDetail } from "@/lib/path-format";
import PathStepScheduler, { slotLabel } from "./PathStepScheduler";
import { AskFirstPanel, useAskFirst, type GenerateFn } from "./AskFirst";

const CATEGORY_LABEL: Record<string, string> = {
  ec: "Activity",
  award: "Award",
  course: "Course",
  project: "Project",
};

type Props = {
  path: Path;
  nodes: PathNode[];
  scheduled: Record<string, PathNodeSchedule>;
  busyId: string | null;
  justKept: string | null;
  onGenerate: GenerateFn;
  onStatus: (id: string, status: PathNode["status"]) => void;
  onAddWork: (parentId: string | null) => void;
  onRemove: (id: string) => void;
  onScheduleChanged: () => Promise<void> | void;
};

function live(nodes: PathNode[]): PathNode[] {
  return nodes.filter((n) => n.status !== "dismissed");
}

export default function PathPlan(props: Props) {
  const { nodes, scheduled, onAddWork } = props;
  const alive = useMemo(() => live(nodes), [nodes]);
  const works = alive.filter((n) => n.parentId === null);
  const ideas = alive.filter((n) => n.kind === "idea");
  const kept = ideas.filter((n) => n.status === "accepted");
  const suggested = ideas.filter((n) => n.status === "suggested");

  // The one thing to do now for this goal.
  const next = useMemo(() => {
    const upcoming = kept
      .filter((n) => scheduled[n.id]?.active)
      .sort((a, b) => {
        const x = scheduled[a.id]!.active!;
        const y = scheduled[b.id]!.active!;
        return (x.date + x.time).localeCompare(y.date + y.time);
      })[0];
    if (upcoming) {
      const { firstStep } = splitNodeDetail(upcoming.detail);
      const at = scheduled[upcoming.id]!.active!;
      return { lead: firstStep || upcoming.title, sub: `${upcoming.title} · ${slotLabel(at.date, at.time)}`, target: upcoming.id };
    }
    const unscheduled = kept[0];
    if (unscheduled) return { lead: `Pick a time to start “${unscheduled.title}”`, sub: "You kept it; give its first step a slot.", target: unscheduled.id };
    if (suggested.length) return { lead: `${suggested.length} move${suggested.length === 1 ? "" : "s"} to look at`, sub: "Keep what fits, pass on the rest.", target: suggested[0].id };
    if (works.length) return { lead: `Find your first moves`, sub: `Start from ${works[0].title}: Tangent asks what it needs to know, then suggests.`, target: works[0].id };
    return null;
  }, [kept, scheduled, suggested, works]);

  const jump = (id: string) => document.getElementById(`pp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="pplan">
      {next && (
        <section className="pplan-next" aria-label="Your next step">
          <div>
            <span className="pplan-label">Your next step</span>
            <strong>{next.lead}</strong>
            <span>{next.sub}</span>
          </div>
          <Button size="sm" variant="primary" onClick={() => jump(next.target)}>
            Go to it
          </Button>
        </section>
      )}

      <div className="pplan-head">
        <h2>What you already do</h2>
        <Button size="sm" onClick={() => onAddWork(null)}>
          <Plus size={14} aria-hidden="true" /> Add something
        </Button>
      </div>

      {works.length === 0 ? (
        <div className="pplan-empty">
          <strong>Start with one real thing you already do toward this.</strong>
          <span>A club, a class, a project, a job. Tangent branches next moves off what&apos;s already there.</span>
          <Button size="sm" variant="primary" onClick={() => onAddWork(null)}>Add the first</Button>
        </div>
      ) : (
        <div className="pplan-works">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} alive={alive} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkCard({ work, alive, busyId, onGenerate, onAddWork, onRemove, ...rest }: Props & { work: PathNode; alive: PathNode[] }) {
  const ask = useAskFirst(work.id, onGenerate);
  const [confirm, setConfirm] = useState(false);
  const children = alive.filter((n) => n.parentId === work.id);
  const busy = busyId === work.id || ask.phase === "checking";
  const facts = [CATEGORY_LABEL[work.category ?? ""], work.hoursPerWeek ? `${work.hoursPerWeek} h a week` : null, work.years ? `${work.years} yr${work.years === 1 ? "" : "s"}` : null].filter(Boolean);

  return (
    <article id={`pp-${work.id}`} className="pplan-work">
      <header className="pplan-work-head">
        <div>
          <h3>{work.title}</h3>
          {facts.length > 0 && <span className="pplan-facts">{facts.join(" · ")}</span>}
        </div>
        {confirm ? (
          <span className="pplan-confirm">
            Remove it and its moves?
            <Button size="sm" variant="danger" onClick={() => onRemove(work.id)}>Remove</Button>
            <Button size="sm" variant="quiet" onClick={() => setConfirm(false)}>Keep</Button>
          </span>
        ) : (
          <button type="button" className="pplan-icon" onClick={() => setConfirm(true)} aria-label={`Remove ${work.title}`} title="Remove">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </header>

      {work.detail ? (
        <p className="pplan-detail">{splitNodeDetail(work.detail).summary || work.detail}</p>
      ) : (
        <p className="pplan-detail is-unknown">Tangent doesn&apos;t know what this is yet. It&apos;ll ask before suggesting anything.</p>
      )}

      <AskFirstPanel ask={ask} title={work.title} />

      {children.length > 0 && (
        <ul className="pplan-ideas">
          {children.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} alive={alive} busyId={busyId} onGenerate={onGenerate} onAddWork={onAddWork} onRemove={onRemove} {...rest} />
          ))}
        </ul>
      )}

      <footer className="pplan-work-actions">
        <Button size="sm" variant={children.length ? "secondary" : "primary"} onClick={() => void ask.start()} disabled={busy || ask.phase === "asking"}>
          <Sparkles size={14} aria-hidden="true" />
          {busy ? "Thinking…" : children.length ? "Suggest more moves" : "Find next moves"}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => onAddWork(work.id)}>
          <Plus size={14} aria-hidden="true" /> Add your own
        </Button>
      </footer>
    </article>
  );
}

function IdeaRow({
  idea,
  alive,
  scheduled,
  busyId,
  justKept,
  onGenerate,
  onStatus,
  onScheduleChanged,
  depth = 0,
  ...rest
}: Omit<Props, "path" | "nodes"> & { idea: PathNode; alive: PathNode[]; depth?: number }) {
  const ask = useAskFirst(idea.id, onGenerate);
  const { summary, firstStep } = splitNodeDetail(idea.detail);
  const children = alive.filter((n) => n.parentId === idea.id);
  const status = idea.status;

  return (
    <li id={`pp-${idea.id}`} className={`pplan-idea is-${status}`} style={{ marginLeft: depth ? 18 : 0 }}>
      <div className="pplan-idea-head">
        {depth > 0 && <CornerDownRight size={14} className="pplan-branch" aria-hidden="true" />}
        <strong>{idea.title}</strong>
        <span className={`pplan-status is-${status}`}>
          {status === "suggested" ? "Suggested" : status === "accepted" ? "Kept" : status === "done" ? "Done" : status}
        </span>
      </div>
      {summary && <p className="pplan-idea-summary">{summary}</p>}
      {(idea.rationale || idea.effort || firstStep) && (
        <dl className="pplan-idea-parts">
          {idea.rationale && (
            <div>
              <dt>Why</dt>
              <dd>{idea.rationale}</dd>
            </div>
          )}
          {firstStep && (
            <div>
              <dt>First step</dt>
              <dd>{firstStep}</dd>
            </div>
          )}
          {idea.effort && (
            <div>
              <dt>Commitment</dt>
              <dd>{idea.effort}</dd>
            </div>
          )}
        </dl>
      )}

      {status === "suggested" && (
        <div className="pplan-idea-actions">
          <Button size="sm" variant="primary" onClick={() => onStatus(idea.id, "accepted")}>
            <Check size={14} aria-hidden="true" /> Keep
          </Button>
          <Button size="sm" onClick={() => onStatus(idea.id, "dismissed")}>
            <X size={14} aria-hidden="true" /> Not for me
          </Button>
        </div>
      )}

      {status === "accepted" && (
        <>
          <div className="pplan-schedule">
            <PathStepScheduler node={idea} schedule={scheduled[idea.id]} autoOpen={justKept === idea.id} onChanged={onScheduleChanged} />
          </div>
          <div className="pplan-idea-actions">
            <Button size="sm" onClick={() => onStatus(idea.id, "done")}>
              <Check size={14} aria-hidden="true" /> Mark done
            </Button>
            <Button size="sm" variant="quiet" onClick={() => void ask.start()} disabled={busyId === idea.id || ask.phase !== "idle"}>
              <Sparkles size={14} aria-hidden="true" /> {busyId === idea.id || ask.phase === "checking" ? "Thinking…" : "Branch from this"}
            </Button>
          </div>
          <AskFirstPanel ask={ask} title={idea.title} />
        </>
      )}

      {children.length > 0 && (
        <ul className="pplan-ideas is-nested">
          {children.map((c) => (
            <IdeaRow
              key={c.id}
              idea={c}
              alive={alive}
              scheduled={scheduled}
              busyId={busyId}
              justKept={justKept}
              onGenerate={onGenerate}
              onStatus={onStatus}
              onScheduleChanged={onScheduleChanged}
              depth={depth + 1}
              {...rest}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
