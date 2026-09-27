"use client";

import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { PathGoalKind } from "@/lib/types";

// Starting a path.
//
// The questions are the coaching-intake shape, which is also exactly what the
// model needs to judge a branch: where you are, where you want to be, by when,
// what you can actually give it, and what is in the way. A goal without a
// current state is a wish, and a goal without hours is a wish with a date on it.
//
// Asked one at a time rather than as a form. Six fields in a single panel reads
// as paperwork; one question at a time reads as being asked, and it is the only
// moment in the product where we get to sound like a person.

export type PathDraft = {
  title: string;
  kind: PathGoalKind;
  target: string;
  current: string;
  deadline: string;
  hoursPerWeek: string;
  constraints: string;
  standing: string;
};

type Props = {
  onCancel: () => void;
  onCreate: (draft: PathDraft) => Promise<boolean>;
};

const KINDS: { value: PathGoalKind; label: string; hint: string }[] = [
  { value: "college", label: "A place to study", hint: "a university, a programme" },
  { value: "career", label: "Work", hint: "a job, an internship, a client" },
  { value: "skill", label: "A level of skill", hint: "a rating, a belt, a certification" },
  { value: "other", label: "Something else", hint: "anything with a finish line" },
];

type Step = {
  key: keyof PathDraft;
  question: string;
  help: string;
  placeholder: string;
  multiline?: boolean;
  optional?: boolean;
};

const STEPS: Step[] = [
  {
    key: "target",
    question: "What are you going after?",
    help: "State it so you could tell whether you hit it. A number, a place, a title.",
    placeholder: "Reach 2000 USCF",
  },
  {
    key: "current",
    question: "Where are you now?",
    help: "The honest version. This is what everything gets measured against.",
    placeholder: "1450, plateaued for about a year",
  },
  {
    key: "deadline",
    question: "By when?",
    help: "A real date or a rough one. Both work.",
    placeholder: "End of next summer",
    optional: true,
  },
  {
    key: "hoursPerWeek",
    question: "How many hours a week can you actually give it?",
    help: "What you can sustain on a normal week, not a good one. Branches get sized to this.",
    placeholder: "6",
    optional: true,
  },
  {
    key: "standing",
    question: "What have you already got going for it?",
    help: "One per line. These become the first circle, so the path does not start empty.",
    placeholder: "Weekly club nights\nTactics trainer streak\nCoach every other Sunday",
    multiline: true,
    optional: true,
  },
  {
    key: "constraints",
    question: "What is in the way?",
    help: "Money, travel, time of year, anything. Tangent will not suggest what you cannot do.",
    placeholder: "No budget for a full-time coach, and exams in May",
    multiline: true,
    optional: true,
  },
];

export default function NewPathDialog({ onCancel, onCreate }: Props) {
  const [draft, setDraft] = useState<PathDraft>({
    title: "",
    kind: "other",
    target: "",
    current: "",
    deadline: "",
    hoursPerWeek: "",
    constraints: "",
    standing: "",
  });
  const [stage, setStage] = useState(-1); // -1 is the name-and-kind screen
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = stage >= 0 ? STEPS[stage] : null;
  const isLast = stage === STEPS.length - 1;
  const value = step ? draft[step.key] : "";

  const set = (key: keyof PathDraft, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const next = async () => {
    setError(null);
    if (stage === -1) {
      if (!draft.title.trim()) {
        setError("Give the path a short name.");
        return;
      }
      setStage(0);
      return;
    }
    if (step && !step.optional && !String(value).trim()) {
      setError("This one matters. Everything else gets judged against it.");
      return;
    }
    if (!isLast) {
      setStage((s) => s + 1);
      return;
    }

    setSubmitting(true);
    const ok = await onCreate(draft);
    setSubmitting(false);
    if (!ok) setError("That didn't save. Try again.");
  };

  return (
    <div className="tangents-intake-scrim" role="dialog" aria-modal="true" aria-label="Start a path">
      <m.div
        className="tangents-intake"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", visualDuration: 0.36, bounce: 0.14 }}
      >
        <header className="tangents-intake-head">
          <span className="tangents-intake-step">
            {stage === -1 ? "New path" : `${stage + 1} of ${STEPS.length}`}
          </span>
          <button type="button" className="path-inspector-close" onClick={onCancel} aria-label="Cancel">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="tangents-intake-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.key} className={i <= stage ? "is-done" : ""} />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={stage}
            className="tangents-intake-body"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ type: "spring", visualDuration: 0.26, bounce: 0 }}
          >
            {stage === -1 ? (
              <>
                <h2>What should we call it?</h2>
                <p>Short. It rides on the sphere.</p>
                <input
                  className="tangents-intake-input"
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="2000 USCF"
                  onKeyDown={(e) => e.key === "Enter" && void next()}
                  autoFocus
                />
                <div className="tangents-kinds" role="radiogroup" aria-label="What kind of goal">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      role="radio"
                      aria-checked={draft.kind === k.value}
                      className={`tangents-kind${draft.kind === k.value ? " is-on" : ""}`}
                      onClick={() => set("kind", k.value)}
                    >
                      <strong>{k.label}</strong>
                      <span>{k.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              step && (
                <>
                  <h2>{step.question}</h2>
                  <p>{step.help}</p>
                  {step.multiline ? (
                    <textarea
                      className="tangents-intake-input is-area"
                      value={String(value)}
                      onChange={(e) => set(step.key, e.target.value)}
                      placeholder={step.placeholder}
                      rows={4}
                      autoFocus
                    />
                  ) : (
                    <input
                      className="tangents-intake-input"
                      value={String(value)}
                      onChange={(e) => set(step.key, e.target.value)}
                      placeholder={step.placeholder}
                      inputMode={step.key === "hoursPerWeek" ? "numeric" : undefined}
                      onKeyDown={(e) => e.key === "Enter" && void next()}
                      autoFocus
                    />
                  )}
                </>
              )
            )}
          </m.div>
        </AnimatePresence>

        {error && (
          <p className="path-form-error" role="alert">
            {error}
          </p>
        )}

        <footer className="tangents-intake-foot">
          <button
            type="button"
            className="path-btn is-quiet"
            onClick={() => (stage <= -1 ? onCancel() : setStage((s) => s - 1))}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {stage <= -1 ? "Cancel" : "Back"}
          </button>
          <button type="button" className="path-btn is-primary" onClick={() => void next()} disabled={submitting}>
            {submitting ? "Creating" : isLast ? "Create the path" : "Next"}
            {!isLast && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </footer>

        {step?.optional && (
          <button type="button" className="tangents-intake-skip" onClick={() => void (isLast ? next() : setStage((s) => s + 1))}>
            Skip this
          </button>
        )}
      </m.div>
    </div>
  );
}
