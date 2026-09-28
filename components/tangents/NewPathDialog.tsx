"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ArrowLeft, ArrowRight, Briefcase, GraduationCap, Target, Trophy, X } from "lucide-react";
import type { PathGoalKind } from "@/lib/types";

// Starting a path.
//
// First you say what kind of thing you are going after, because a university,
// a job, a rating and "anything else" are measured differently, and asking all
// four the same generic questions got generic answers. Every question after
// that is worded for the kind you picked, says in plain words what a good
// answer looks like, and shows one.
//
// The answers land in the same six facts the model is given for every branch:
// the target, where you are, the deadline, the hours you can give it, what you
// already have (which seeds the first circle) and what is in the way. A goal
// without a current state is a wish; a goal without hours is a wish with a date.
//
// One question at a time rather than a form: six fields in one panel reads as
// paperwork; one at a time reads as being asked.

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

type FieldKey = Exclude<keyof PathDraft, "kind">;

/** One input inside a grouped step. */
type Field = {
  key: FieldKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
  numeric?: boolean;
  /** One-tap answers, for the fields where most people pick a common one. */
  chips?: string[];
};

type Step = {
  question: string;
  help: string;
  optional?: boolean;
  /** A step that asks one thing. */
  key?: FieldKey;
  placeholder?: string;
  multiline?: boolean;
  chips?: string[];
  /** A step that asks several, all on one panel. */
  fields?: Field[];
};

const KINDS: { value: PathGoalKind; label: string; hint: string; icon: typeof Target }[] = [
  { value: "college", label: "Get into a school", hint: "A university, college or programme", icon: GraduationCap },
  { value: "career", label: "Land a role", hint: "A job, internship or first client", icon: Briefcase },
  { value: "skill", label: "Reach a level", hint: "A rating, grade, belt or certification", icon: Trophy },
  { value: "other", label: "Something else", hint: "Anything with a clear finish line", icon: Target },
];

/** The optional half of the intake, on one panel.
 *
 * These four were four more questions, asked one at a time, after the two that
 * actually gate a useful path. That put six screens between picking a kind and
 * seeing anything, and four of them could be skipped, so the common path was
 * a person pressing "Skip this" four times. They are one panel now: still
 * optional, still worded for the kind, but answerable in any order or not at
 * all. The two questions a path cannot be built without stay one at a time.
 */
const REST = (labels: {
  deadline: string;
  deadlineEg: string;
  standing: string;
  standingEg: string;
  constraints: string;
  constraintsEg: string;
}): Step => ({
  question: "Anything else worth knowing?",
  help: "All optional. Skip it and Tangent still builds the path; answering makes what it suggests fit you rather than fit anyone.",
  optional: true,
  fields: [
    { key: "deadline", label: labels.deadline, placeholder: labels.deadlineEg },
    {
      key: "hoursPerWeek",
      label: "Hours a week you can really give it",
      placeholder: "5",
      numeric: true,
      chips: ["2", "4", "6", "10"],
    },
    { key: "standing", label: labels.standing, placeholder: labels.standingEg, multiline: true },
    { key: "constraints", label: labels.constraints, placeholder: labels.constraintsEg, multiline: true },
  ],
});

/** The questions, worded for each kind. Same six facts underneath. */
const QUESTIONS: Record<PathGoalKind, { name: string; steps: Step[] }> = {
  college: {
    name: "Georgia Tech",
    steps: [
      {
        key: "target",
        question: "Which school, and for what?",
        help: "Name the school and the major or programme. If you have a shortlist, pick the one you want most.",
        placeholder: "Georgia Tech, Computer Science",
      },
      {
        key: "current",
        question: "Where do you stand today?",
        help: "Your grade, GPA, test scores, and the classes you are taking. Be honest; this is only for you.",
        placeholder: "Junior, 3.8 unweighted, SAT 1420, taking AP Calc BC",
      },
      REST({
        deadline: "When you apply",
        deadlineEg: "Nov 1, 2027 (early action)",
        standing: "What you already do that the school would care about",
        standingEg: "Robotics club, programming lead\nSummer research at the university lab\nVarsity tennis",
        constraints: "What limits what you can do",
        constraintsEg: "No car, can't pay for summer programmes, tennis season Aug to Nov",
      }),
    ],
  },
  career: {
    name: "Fintech internship",
    steps: [
      {
        key: "target",
        question: "What role, and where?",
        help: "The job title and the kind of place. A specific company is great if you have one.",
        placeholder: "Summer software internship at a fintech startup",
      },
      {
        key: "current",
        question: "What would your resume say today?",
        help: "Experience, skills and anything you have built. Leave nothing out because it feels small.",
        placeholder: "One Python project on GitHub, part-time cashier, no resume yet",
      },
      REST({
        deadline: "When you need it by",
        deadlineEg: "Applications close Feb 2027",
        standing: "What you are already doing that counts toward it",
        standingEg: "Building a budgeting app\nCS club\nPart-time cashier",
        constraints: "What's in the way",
        constraintsEg: "Remote only, no referrals, school until 3pm",
      }),
    ],
  },
  skill: {
    name: "2000 USCF",
    steps: [
      {
        key: "target",
        question: "What level, and how is it measured?",
        help: "A number or a title someone else could check: a rating, a grade, a belt, a certification.",
        placeholder: "2000 USCF rating",
      },
      {
        key: "current",
        question: "Where are you now, by that same measure?",
        help: "Your current number or level, and how long you have been there.",
        placeholder: "1450 USCF, stuck for about a year",
      },
      REST({
        deadline: "By when",
        deadlineEg: "End of next summer",
        standing: "How you practise now",
        standingEg: "Weekly class\nRapid games on chess.com\nA chess book\nPuzzles",
        constraints: "What gets in the way of practising",
        constraintsEg: "No budget for a coach, exams in May",
      }),
    ],
  },
  other: {
    name: "First album",
    steps: [
      {
        key: "target",
        question: "What does done look like?",
        help: "Say it so a friend could check whether you did it.",
        placeholder: "Release a 10-song album on Spotify",
      },
      {
        key: "current",
        question: "Where are you now?",
        help: "What exists today, and what doesn't yet.",
        placeholder: "8 demos recorded, nothing mixed, no cover art",
      },
      REST({
        deadline: "By when",
        deadlineEg: "Before next summer",
        standing: "What you have already got going for it",
        standingEg: "Home recording setup\nA friend who mixes\nSongwriting every Sunday",
        constraints: "What's in the way",
        constraintsEg: "No budget for mastering, can't sing live",
      }),
    ],
  },
};

const NAME_STEP = (placeholder: string): Step => ({
  key: "title",
  question: "Give it a short name",
  help: "Two or three words. It's the label you'll see on your path.",
  placeholder,
});

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
  // -1 is choosing the kind; 0 is the name; then the kind's own questions.
  const [stage, setStage] = useState(-1);
  const [picked, setPicked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(() => {
    const set = QUESTIONS[draft.kind];
    return [NAME_STEP(set.name), ...set.steps];
  }, [draft.kind]);

  const step = stage >= 0 ? steps[stage] : null;
  const isLast = stage === steps.length - 1;
  const value = step?.key ? draft[step.key] : "";

  const set = (key: FieldKey, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  const choose = (kind: PathGoalKind) => {
    setDraft((d) => ({ ...d, kind }));
    setPicked(true);
    setError(null);
    // Straight on: picking is the answer.
    setStage(0);
  };

  const next = async () => {
    setError(null);
    if (stage === -1) {
      if (!picked) {
        setError("Pick the one closest to your goal.");
        return;
      }
      setStage(0);
      return;
    }
    if (step?.key && !step.optional && !String(value).trim()) {
      setError(step.key === "title" ? "Give it a short name first." : "This one matters: every suggestion is judged against it.");
      return;
    }
    const hours = draft.hoursPerWeek.trim();
    const asksHours = step?.key === "hoursPerWeek" || step?.fields?.some((f) => f.key === "hoursPerWeek");
    if (asksHours && hours && !(Number(hours) > 0)) {
      setError("Just a number of hours, like 5.");
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

  const total = steps.length;

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
            {stage === -1 ? "New path" : `Question ${stage + 1} of ${total}`}
          </span>
          <button type="button" className="path-inspector-close" onClick={onCancel} aria-label="Cancel">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="tangents-intake-progress" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.key} className={i <= stage ? "is-done" : ""} />
          ))}
        </div>

        {/* popLayout, not wait: the next question mounts and takes focus at
            once, while the last one slides out underneath. With "wait" the
            old field kept focus through its exit, and anything typed in that
            moment went into a field that was about to disappear. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={stage}
            className="tangents-intake-body"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            // A quick fade out, so the outgoing question barely overlaps the new one.
            exit={{ opacity: 0, x: -12, transition: { duration: 0.12, ease: "easeOut" } }}
            transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
          >
            {stage === -1 ? (
              <>
                <h2>What are you working toward?</h2>
                <p>Pick the closest one. The questions after this are shaped around it.</p>
                <div className="tangents-kinds" role="radiogroup" aria-label="What kind of goal">
                  {KINDS.map((k) => {
                    const Icon = k.icon;
                    return (
                      <button
                        key={k.value}
                        type="button"
                        role="radio"
                        aria-checked={picked && draft.kind === k.value}
                        className={`tangents-kind${picked && draft.kind === k.value ? " is-on" : ""}`}
                        onClick={() => choose(k.value)}
                      >
                        <span className="tangents-kind-icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <strong>{k.label}</strong>
                        <span>{k.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              step && (
                <>
                  <h2>{step.question}</h2>
                  <p>{step.help}</p>
                  {step.fields ? (
                    <div className="tangents-intake-group">
                      {step.fields.map((field, i) => (
                        <label key={field.key} className="tangents-intake-field">
                          <span>{field.label}</span>
                          {field.multiline ? (
                            <textarea
                              className="tangents-intake-input is-area"
                              value={String(draft[field.key])}
                              onChange={(e) => set(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              rows={3}
                            />
                          ) : (
                            <input
                              className="tangents-intake-input"
                              value={String(draft[field.key])}
                              onChange={(e) => set(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              inputMode={field.numeric ? "numeric" : undefined}
                              autoFocus={i === 0}
                            />
                          )}
                          {field.chips && (
                            <div className="tangents-intake-chips" role="group" aria-label={`Quick answers for ${field.label}`}>
                              {field.chips.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  className={`tangents-intake-chip${String(draft[field.key]) === chip ? " is-on" : ""}`}
                                  onClick={() => set(field.key, chip)}
                                >
                                  {chip} h
                                </button>
                              ))}
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : step.multiline ? (
                    <textarea
                      className="tangents-intake-input is-area"
                      value={String(value)}
                      onChange={(e) => step.key && set(step.key, e.target.value)}
                      placeholder={step.placeholder}
                      rows={4}
                      autoFocus
                    />
                  ) : (
                    <input
                      className="tangents-intake-input"
                      value={String(value)}
                      onChange={(e) => step.key && set(step.key, e.target.value)}
                      placeholder={step.placeholder}
                      inputMode={step.key === "hoursPerWeek" ? "numeric" : undefined}
                      onKeyDown={(e) => e.key === "Enter" && void next()}
                      autoFocus
                    />
                  )}
                  {step.chips && (
                    <div className="tangents-intake-chips" role="group" aria-label="Quick answers">
                      {step.chips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className={`tangents-intake-chip${String(value) === chip ? " is-on" : ""}`}
                          onClick={() => step.key && set(step.key, chip)}
                        >
                          {chip} h
                        </button>
                      ))}
                    </div>
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
          {stage >= 0 && (
            <button type="button" className="path-btn is-primary" onClick={() => void next()} disabled={submitting}>
              {submitting ? "Creating" : isLast ? "Create the path" : "Next"}
              {!isLast && <ArrowRight size={15} aria-hidden="true" />}
            </button>
          )}
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
