"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Path, PathNode, PathNodeSchedule } from "@/lib/types";
import { splitNodeDetail } from "@/lib/path-format";
import PathStepScheduler from "./PathStepScheduler";

// The panel beside the drawing.
//
// The drawing carries the shape of things; sentences on it were the first thing
// that made the old version unreadable. So a node on the canvas shows its title
// and nothing else, and everything you might want to read or do about it lives
// here, one node at a time.

type Props = {
  path: Path;
  node: PathNode | null;
  ancestry: PathNode[];
  childCount: number;
  busy: boolean;
  /** The node's first step on the calendar, derived from its linked tasks. */
  schedule: PathNodeSchedule | undefined;
  /** Just kept: open the time picker straight away. */
  justKept: boolean;
  onScheduleChanged: () => Promise<void> | void;
  onClose: () => void;
  /** Answers to "what is this?" go along, and are kept on the item. */
  onGenerate: (id: string, answers?: { question: string; answer: string }[]) => void;
  onStatus: (id: string, status: PathNode["status"]) => void;
  onAddWork: (parentId: string | null) => void;
  onRemove: (id: string) => void;
  onSelectAncestor: (id: string | null) => void;
};

const CATEGORY_LABEL: Record<string, string> = {
  ec: "Activity",
  award: "Award",
  course: "Course",
  project: "Project",
};

type ItemQuestion = { question: string; chips: string[] };

/** Before drafting off an item, ask what Tangent would otherwise guess
 *  (/api/path-intake nodeQuestions). Nothing to ask: draft straight away. */
function useAskFirst(nodeId: string | null, onGenerate: Props["onGenerate"]) {
  const [phase, setPhase] = useState<"idle" | "checking" | "asking">("idle");
  const [questions, setQuestions] = useState<ItemQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  useEffect(() => {
    setPhase("idle");
    setQuestions([]);
    setAnswers([]);
  }, [nodeId]);

  const start = async () => {
    if (!nodeId) return;
    setPhase("checking");
    try {
      const res = await fetch("/api/path-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nodeQuestions", nodeId }),
      });
      const data = (await res.json()) as { questions?: ItemQuestion[] };
      const qs = data.questions ?? [];
      if (qs.length === 0) {
        setPhase("idle");
        onGenerate(nodeId);
        return;
      }
      setQuestions(qs);
      setAnswers(qs.map(() => ""));
      setPhase("asking");
    } catch {
      setPhase("idle");
      onGenerate(nodeId);
    }
  };

  const submit = (skip = false) => {
    if (!nodeId) return;
    const given = skip ? [] : questions.map((q, i) => ({ question: q.question, answer: answers[i].trim() })).filter((a) => a.answer);
    setPhase("idle");
    onGenerate(nodeId, given);
  };

  return { phase, questions, answers, setAnswers, start, submit };
}

export default function PathInspector({
  path,
  node,
  ancestry,
  childCount,
  busy,
  schedule,
  justKept,
  onScheduleChanged,
  onClose,
  onGenerate,
  onStatus,
  onAddWork,
  onRemove,
  onSelectAncestor,
}: Props) {
  const ask = useAskFirst(node?.id ?? null, onGenerate);
  return (
    <AnimatePresence>
      {node && (
        <m.aside
          // AnimatePresence tracks its children by key. A stable one rather than
          // the node id, so moving between nodes updates the panel in place
          // instead of tearing it down and rebuilding it.
          key="path-inspector"
          className="path-inspector"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", visualDuration: 0.34, bounce: 0.12 }}
          aria-label="Selected node"
        >
          <header className="path-inspector-head">
            <nav className="path-crumbs" aria-label="Where this sits">
              <button type="button" onClick={() => onSelectAncestor(null)}>
                {path.title}
              </button>
              {ancestry.slice(0, -1).map((a) => (
                <button key={a.id} type="button" onClick={() => onSelectAncestor(a.id)}>
                  {a.title}
                </button>
              ))}
            </nav>
            <button type="button" className="path-inspector-close" onClick={onClose} aria-label="Close">
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <p className="path-inspector-kind">
            {node.kind === "idea"
              ? node.origin === "tangent"
                ? "Branch Tangent drafted"
                : "Branch you wrote"
              : CATEGORY_LABEL[node.category ?? "ec"]}
          </p>
          <h2 className="path-inspector-title">{node.title}</h2>

          {/* The card on the drawing carries only the short title; the
              substance lives here, in labelled parts. Drafted branches store
              "summary\n\nFirst step: ..." in detail. */}
          {(() => {
            const { summary, firstStep } = splitNodeDetail(node.detail);
            return (
              <>
                {summary && <p className="path-inspector-body is-lead">{summary}</p>}
                {node.rationale && (
                  <section className="path-inspector-part">
                    <h3>Why this</h3>
                    <p>{node.rationale}</p>
                  </section>
                )}
                {firstStep && (
                  <section className="path-inspector-part is-step">
                    <h3>First step, this week</h3>
                    <p>{firstStep}</p>
                  </section>
                )}
              </>
            );
          })()}

          <PathStepScheduler node={node} schedule={schedule} autoOpen={justKept} onChanged={onScheduleChanged} />

          {(node.effort || node.hoursPerWeek || node.years) && (
            <dl className="path-facts">
              {node.effort && (
                <div>
                  <dt>Commitment</dt>
                  <dd>{node.effort}</dd>
                </div>
              )}
              {node.hoursPerWeek && (
                <div>
                  <dt>Hours a week</dt>
                  <dd>{node.hoursPerWeek}</dd>
                </div>
              )}
              {node.years && (
                <div>
                  <dt>Years</dt>
                  <dd>{node.years}</dd>
                </div>
              )}
            </dl>
          )}

          {ask.phase === "asking" && (
            <section className="path-ask" aria-label="What Tangent needs to know first">
              <h3>Before I suggest anything about {node.title}</h3>
              {ask.questions.map((q, i) => (
                <div key={q.question} className="path-ask-q">
                  <p>{q.question}</p>
                  {q.chips.length > 0 && (
                    <div className="path-ask-chips">
                      {q.chips.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`path-step-chip${ask.answers[i] === c ? " is-on" : ""}`}
                          onClick={() => ask.setAnswers((a) => a.map((v, j) => (j === i ? c : v)))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className="path-ask-input"
                    value={q.chips.includes(ask.answers[i]) ? "" : ask.answers[i]}
                    placeholder={q.chips.length ? "Or say it in your words" : "Tell Tangent"}
                    aria-label={q.question}
                    onChange={(e) => ask.setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask.submit();
                    }}
                  />
                </div>
              ))}
              <div className="path-ask-actions">
                <button type="button" className="path-btn is-primary" onClick={() => ask.submit()} disabled={!ask.answers.some((a) => a.trim())}>
                  <Sparkles size={15} aria-hidden="true" />
                  Suggest moves
                </button>
                <button type="button" className="path-btn is-quiet" onClick={() => ask.submit(true)}>
                  Skip, just draft
                </button>
              </div>
            </section>
          )}

          <div className="path-inspector-actions">
            {node.kind === "idea" && node.status === "suggested" && (
              <>
                <button type="button" className="path-btn is-primary" onClick={() => onStatus(node.id, "accepted")}>
                  <Check size={15} aria-hidden="true" />
                  Keep this
                </button>
                <button type="button" className="path-btn" onClick={() => onStatus(node.id, "dismissed")}>
                  Not for me
                </button>
              </>
            )}

            {node.kind === "idea" && node.status === "accepted" && (
              <button type="button" className="path-btn" onClick={() => onStatus(node.id, "done")}>
                <Check size={15} aria-hidden="true" />
                Mark done
              </button>
            )}

            <button
              type="button"
              className="path-btn is-accent"
              onClick={() => void ask.start()}
              disabled={busy || ask.phase !== "idle"}
            >
              <Sparkles size={15} aria-hidden="true" />
              {busy ? "Thinking" : ask.phase === "checking" ? "Checking what I know" : childCount > 0 ? "Draft three more" : "Branch from here"}
            </button>

            {node.kind === "idea" && (
              <button type="button" className="path-btn" onClick={() => onAddWork(node.id)}>
                <Plus size={15} aria-hidden="true" />
                Add your own
              </button>
            )}

            <button type="button" className="path-btn is-quiet" onClick={() => onRemove(node.id)}>
              <Trash2 size={15} aria-hidden="true" />
              Remove
            </button>
          </div>

          {childCount > 0 && (
            <p className="path-inspector-note">
              {childCount} {childCount === 1 ? "branch grows" : "branches grow"} from here. Open the circle on the
              drawing to walk into them.
            </p>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  );
}
