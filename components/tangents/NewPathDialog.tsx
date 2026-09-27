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

type Step = {
  key: FieldKey;
  question: string;
  help: string;
  placeholder: string;
  multiline?: boolean;
  optional?: boolean;
  /** One-tap answers, for the questions where most people pick a common one. */
  chips?: string[];
};

const KINDS: { value: PathGoalKind; label: string; hint: string; icon: typeof Target }[] = [
  { value: "college", label: "Get into a school", hint: "A university, college or programme", icon: GraduationCap },
  { value: "career", label: "Land a role", hint: "A job, internship or first client", icon: Briefcase },
  { value: "skill", label: "Reach a level", hint: "A rating, grade, belt or certification", icon: Trophy },
  { value: "other", label: "Something else", hint: "Anything with a clear finish line", icon: Target },
];

const HOURS: Step = {
  key: "hoursPerWeek",
  question: "How many hours a week can you really give it?",
  help: "Think of a normal week, not your best one. Every suggestion gets sized to fit this.",
  placeholder: "5",
  optional: true,
  chips: ["2", "4", "6", "10"],
};

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
      {
        key: "deadline",
        question: "When do you apply?",
        help: "The date you actually submit by. A rough one is fine.",
        placeholder: "Nov 1, 2027 (early action)",
        optional: true,
      },
      HOURS,
      {
        key: "standing",
        question: "What are you already doing that the school would care about?",
        help: "One per line: clubs, jobs, projects, sports, awards. These become the first circle of your path.",
        placeholder: "Robotics club, programming lead\nSummer research at the university lab\nVarsity tennis",
        multiline: true,
        optional: true,
      },
      {
        key: "constraints",
        question: "What limits what you can do?",
        help: "Money, getting places, family, school rules. Tangent won't suggest anything you can't actually do.",
        placeholder: "No car, can't pay for summer programmes, tennis season Aug to Nov",
        multiline: true,
        optional: true,
      },
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
      {
        key: "deadline",
        question: "When do you need it by?",
        help: "When applications close, or when you want to start.",
        placeholder: "Applications close Feb 2027",
        optional: true,
      },
      HOURS,
      {
        key: "standing",
        question: "What are you already doing that counts toward it?",
        help: "One per line: projects, classes, clubs, jobs. These become the first circle of your path.",
        placeholder: "Building a budgeting app\nCS club\nPart-time cashier",
        multiline: true,
        optional: true,
      },
      {
        key: "constraints",
        question: "What's in the way?",
        help: "Location, time, money, no contacts yet. Tangent plans around it instead of ignoring it.",
        placeholder: "Remote only, no referrals, school until 3pm",
        multiline: true,
        optional: true,
      },
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
      {
        key: "deadline",
        question: "By when?",
        help: "A real date or a rough one. Both work.",
        placeholder: "End of next summer",
        optional: true,
      },
      HOURS,
      {
        key: "standing",
        question: "How do you practise now?",
        help: "One per line: classes, coaches, apps, books, routines. These become the first circle of your path.",
        placeholder: "Weekly class\nRapid games on chess.com\nA chess book\nPuzzles",
        multiline: true,
        optional: true,
      },
      {
        key: "constraints",
        question: "What gets in the way of practising?",
        help: "Money, time of year, equipment, anything. Tangent won't suggest what you can't do.",
        placeholder: "No budget for a coach, exams in May",
        multiline: true,
        optional: true,
      },
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
      {
        key: "deadline",
        question: "By when?",
        help: "A real date or a rough one. Both work.",
        placeholder: "Before next summer",
        optional: true,
      },
      HOURS,
      {
        key: "standing",
        question: "What have you already got going for it?",
        help: "One per line: habits, tools, people, things in progress. These become the first circle of your path.",
        placeholder: "Home recording setup\nA friend who mixes\nSongwriting every Sunday",
        multiline: true,
        optional: true,
      },
      {
        key: "constraints",
        question: "What's in the way?",
        help: "Money, time, skills you don't have yet. Tangent plans around it.",
        placeholder: "No budget for mastering, can't sing live",
        multiline: true,
        optional: true,
      },
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
  const value = step ? draft[step.key] : "";

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
    if (step && !step.optional && !String(value).trim()) {
      setError(step.key === "title" ? "Give it a short name first." : "This one matters: every suggestion is judged against it.");
      return;
    }
    if (step?.key === "hoursPerWeek" && String(value).trim() && !(Number(value) > 0)) {
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
                  {step.chips && (
                    <div className="tangents-intake-chips" role="group" aria-label="Quick answers">
                      {step.chips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className={`tangents-intake-chip${String(value) === chip ? " is-on" : ""}`}
                          onClick={() => set(step.key, chip)}
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
