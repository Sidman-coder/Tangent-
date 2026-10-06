"use client";

// The first-run flow. Every answer lives in a local draft (saved to
// localStorage per student, so Back keeps it and a refresh resumes it) until
// "Open Tangent", which is the one server save. The questions, their answers
// and the final-screen copy are defined in lib/onboarding.ts.

import "./FirstRun.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import TangentLogo from "@/components/TangentLogo";
import Button from "@/components/ui/Button";
import { useAppState } from "@/components/AppStateProvider";
import { browserTimezone } from "@/lib/time";
import {
  DAY_VIEW_OPTIONS,
  DISPLAY_NAME_MAX,
  HELP_FOCUS_OPTIONS,
  INTENT_EXAMPLES,
  SLIP_POINT_OPTIONS,
  STARTING_INTENT_MAX,
  WORKING_TOWARD_OPTIONS,
  canContinue,
  draftFromSaved,
  draftStorageKey,
  emptyDraft,
  parseSchoolHours,
  parseStoredDraft,
  readyLines,
  readySummary,
  resumeStep,
  serializeDraft,
  stepsFor,
  submissionFromDraft,
  type Choice,
  type OnboardingDraft,
  type StepId,
} from "@/lib/onboarding";

/** Long enough to see the selection land before the next question. */
const AUTO_ADVANCE_MS = 260;
const EXAMPLE_ROTATE_MS = 2800;

// Monday-first, matching the rest of the app.
const WEEKDAYS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the flow still works, it just won't resume */
  }
}

export default function FirstRun({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const { state } = useAppState();
  const user = state?.user;
  const storageKey = draftStorageKey(user?.email || "anonymous");

  // Decided once: whether the name question shows doesn't change mid-flow.
  const [steps] = useState<StepId[]>(() => stepsFor(!user?.displayName?.trim()));

  // Resume an unfinished draft; otherwise start from saved answers (Redo
  // setup) or from nothing.
  const [initial] = useState(() => {
    const stored = parseStoredDraft(readStorage(storageKey));
    if (stored) return { step: resumeStep(steps, stored.step, stored.draft), draft: stored.draft };
    const draft = user
      ? draftFromSaved({ displayName: user.displayName, preferences: user, school: user.schoolHours ?? null })
      : emptyDraft();
    return { step: steps[0], draft };
  });
  const [step, setStep] = useState<StepId>(initial.step);
  const [draft, setDraft] = useState<OnboardingDraft>(initial.draft);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    writeStorage(storageKey, serializeDraft(step, draft));
  }, [storageKey, step, draft]);

  const index = steps.indexOf(step);
  const questionCount = steps.length - 1; // the ready screen isn't a question
  const progress = step === "ready" ? 1 : index / questionCount;

  const goTo = useCallback(
    (next: StepId) => {
      setDirection(steps.indexOf(next) >= steps.indexOf(step) ? 1 : -1);
      setStep(next);
    },
    [steps, step]
  );

  // Pending auto-advance after a single choice (see chooseAndAdvance).
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(() => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) goTo(steps[i + 1]);
  }, [steps, step, goTo]);

  const back = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (index > 0) goTo(steps[index - 1]);
  };

  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Auto-advance after a single choice, once the selection has been seen.
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);
  const chooseAndAdvance = (patch: Partial<OnboardingDraft>) => {
    update(patch);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(next, AUTO_ADVANCE_MS);
  };

  // Each question's heading takes focus as it mounts (see StepHeading).
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // The app behind the flow is out of reach while it is open: no tabbing into
  // the rail or Home, and screen readers see only the question.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    const parent = root?.parentElement;
    if (!root || !parent) return;
    const others = Array.from(parent.children).filter((el): el is HTMLElement => el !== root && el instanceof HTMLElement && !el.inert);
    others.forEach((el) => (el.inert = true));
    return () => others.forEach((el) => (el.inert = false));
  }, []);

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = submissionFromDraft(draft, { includeName: steps.includes("name"), timezone: browserTimezone() });
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Couldn't save your setup. Try again.");
      writeStorage(storageKey, null);
      setLeaving(true);
      await onComplete();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save your setup. Try again.");
      setSaving(false);
    }
  };

  const reduce = useReducedMotion();
  const variants = {
    enter: (dir: number) => ({ opacity: 0, y: reduce ? 0 : 14 * dir }),
    center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
    exit: (dir: number) => ({ opacity: 0, y: reduce ? 0 : -8 * dir, transition: { duration: 0.2 } }),
  };

  const stepNumber = step === "ready" ? null : index + 1;

  return (
    <div ref={rootRef} className={`onb${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Set up Tangent">
      <header className="onb-top">
        <div className="onb-top-row">
          {index > 0 && step !== "ready" ? (
            <button type="button" className="onb-back" onClick={back} aria-label="Back">
              <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
          ) : (
            <span className="onb-back-spacer" aria-hidden="true" />
          )}
          <TangentLogo size={26} />
          <span className="onb-count" aria-live="polite">
            {stepNumber ? `${stepNumber} of ${questionCount}` : ""}
          </span>
        </div>
        <div
          className="onb-progress"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <main className="onb-main">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <m.section
            key={step}
            className="onb-step"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === "name" && (
              <NameStep
                headingRef={headingRef}
                value={draft.name}
                onChange={(name) => update({ name })}
                onContinue={() => canContinue("name", draft) && next()}
              />
            )}

            {step === "help" && (
              <ChoiceStep
                headingRef={headingRef}
                title="What do you want Tangent to help with most?"
                options={HELP_FOCUS_OPTIONS}
                value={draft.helpFocus}
                onChoose={(helpFocus) => chooseAndAdvance({ helpFocus })}
              />
            )}

            {step === "slip" && (
              <ChoiceStep
                headingRef={headingRef}
                title="What usually slips through?"
                options={SLIP_POINT_OPTIONS}
                value={draft.slipPoint}
                onChoose={(slipPoint) => chooseAndAdvance({ slipPoint })}
              />
            )}

            {step === "view" && (
              <ChoiceStep
                headingRef={headingRef}
                title="What do you want to see first?"
                options={DAY_VIEW_OPTIONS}
                value={draft.dayView}
                onChoose={(dayView) => chooseAndAdvance({ dayView })}
              />
            )}

            {step === "school" && (
              <SchoolStep
                headingRef={headingRef}
                draft={draft}
                onChange={update}
                onContinue={() => {
                  update({ schoolMode: "set" });
                  next();
                }}
                onVaries={() => chooseAndAdvance({ schoolMode: "varies" })}
                onSkip={() => chooseAndAdvance({ schoolMode: "skip" })}
              />
            )}

            {step === "toward" && (
              <ChoiceStep
                headingRef={headingRef}
                title="What are you working toward right now?"
                options={WORKING_TOWARD_OPTIONS}
                value={draft.workingToward}
                onChoose={(workingToward) => chooseAndAdvance({ workingToward })}
              />
            )}

            {step === "intent" && (
              <IntentStep
                headingRef={headingRef}
                value={draft.startingIntent}
                onChange={(startingIntent) => update({ startingIntent })}
                onStart={next}
                onSkip={() => {
                  update({ startingIntent: "" });
                  next();
                }}
              />
            )}

            {step === "ready" && (
              <ReadyStep
                headingRef={headingRef}
                draft={draft}
                saving={saving}
                error={saveError}
                onOpen={() => void finish()}
                onChange={() => goTo(steps.includes("name") ? steps[1] : steps[0])}
              />
            )}
          </m.section>
        </AnimatePresence>
      </main>
    </div>
  );
}

type HeadingRef = React.MutableRefObject<HTMLHeadingElement | null>;

function StepHeading({ headingRef, title, sub }: { headingRef: HeadingRef; title: string; sub?: string }) {
  // Move focus to each new question as it mounts, so keyboard and screen-reader
  // users land on it rather than on a button that no longer exists. On mount,
  // not on step change: with AnimatePresence "wait" the new heading only
  // appears after the old one has left. A field that took focus itself keeps it.
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    headingRef.current?.focus({ preventScroll: true });
  }, [headingRef]);
  return (
    <div className="onb-heading">
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function NameStep({
  headingRef,
  value,
  onChange,
  onContinue,
}: {
  headingRef: HeadingRef;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <form
      className="onb-form"
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <StepHeading headingRef={headingRef} title="What should we call you?" />
      <label className="onb-sr" htmlFor="onb-name">
        Your name
      </label>
      <input
        id="onb-name"
        className="onb-input"
        type="text"
        autoComplete="given-name"
        maxLength={DISPLAY_NAME_MAX}
        placeholder="Your name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="onb-cta">
        <Button type="submit" variant="primary" disabled={!value.trim()}>
          Continue
        </Button>
      </div>
    </form>
  );
}

function ChoiceStep<T extends string>({
  headingRef,
  title,
  options,
  value,
  onChoose,
}: {
  headingRef: HeadingRef;
  title: string;
  options: Choice<T>[];
  value: T | null;
  onChoose: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);
  // Roving focus: arrow keys move between cards; Enter or Space chooses.
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    refs.current[(i + delta + options.length) % options.length]?.focus();
  };
  return (
    <>
      <StepHeading headingRef={headingRef} title={title} />
      <div className="onb-choices" role="radiogroup" aria-label={title}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === (selected >= 0 ? selected : 0) ? 0 : -1}
              className={`onb-choice${on ? " is-on" : ""}`}
              onClick={() => onChoose(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="onb-choice-text">
                <span className="onb-choice-label">{o.label}</span>
                {o.hint && <span className="onb-choice-hint">{o.hint}</span>}
              </span>
              <span className="onb-choice-check" aria-hidden="true">
                {on && <Check size={14} strokeWidth={2.4} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function SchoolStep({
  headingRef,
  draft,
  onChange,
  onContinue,
  onVaries,
  onSkip,
}: {
  headingRef: HeadingRef;
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onContinue: () => void;
  onVaries: () => void;
  onSkip: () => void;
}) {
  const { school } = draft;
  const valid = parseSchoolHours(school) !== null;
  const noDays = school.days.length === 0;
  const badTimes = !noDays && !valid;
  const setSchool = (patch: Partial<typeof school>) => onChange({ school: { ...school, ...patch } });
  const toggle = (d: number) =>
    setSchool({ days: school.days.includes(d) ? school.days.filter((x) => x !== d) : [...school.days, d].sort((a, b) => a - b) });

  return (
    <>
      <StepHeading
        headingRef={headingRef}
        title="About when are you at school?"
        sub="Tangent plans around this time. Close enough is fine."
      />
      <fieldset className="onb-fieldset">
        <legend className="onb-label">Days</legend>
        <div className="onb-days">
          {WEEKDAYS.map((d) => {
            const on = school.days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                className={`onb-day${on ? " is-on" : ""}`}
                aria-pressed={on}
                aria-label={d.label}
                onClick={() => toggle(d.value)}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="onb-times">
        <label className="onb-time">
          <span className="onb-label">Starts</span>
          <input className="onb-input" type="time" value={school.start} onChange={(e) => setSchool({ start: e.target.value })} />
        </label>
        <label className="onb-time">
          <span className="onb-label">Ends</span>
          <input className="onb-input" type="time" value={school.end} onChange={(e) => setSchool({ end: e.target.value })} />
        </label>
      </div>
      <p className="onb-error" role="status">
        {noDays ? "Pick at least one day, or choose an option below." : badTimes ? "The end time needs to be after the start." : ""}
      </p>
      <div className="onb-alt">
        <button
          type="button"
          className={`onb-link${draft.schoolMode === "varies" ? " is-on" : ""}`}
          aria-pressed={draft.schoolMode === "varies"}
          onClick={onVaries}
        >
          My schedule varies
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className={`onb-link${draft.schoolMode === "skip" ? " is-on" : ""}`}
          aria-pressed={draft.schoolMode === "skip"}
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
      <div className="onb-cta">
        <Button type="button" variant="primary" disabled={!valid} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </>
  );
}

function IntentStep({
  headingRef,
  value,
  onChange,
  onStart,
  onSkip,
}: {
  headingRef: HeadingRef;
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  onSkip: () => void;
}) {
  const reduce = useReducedMotion();
  const [example, setExample] = useState(0);
  useEffect(() => {
    if (reduce || value) return;
    const id = setInterval(() => setExample((i) => (i + 1) % INTENT_EXAMPLES.length), EXAMPLE_ROTATE_MS);
    return () => clearInterval(id);
  }, [reduce, value]);
  const has = value.trim().length > 0;

  return (
    <form
      className="onb-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (has) onStart();
      }}
    >
      <StepHeading
        headingRef={headingRef}
        title="Anything you want to make progress on?"
        sub="You can start with one thing, or skip this."
      />
      <label className="onb-sr" htmlFor="onb-intent">
        Something you want to make progress on
      </label>
      <input
        id="onb-intent"
        className="onb-input"
        type="text"
        maxLength={STARTING_INTENT_MAX}
        placeholder={`e.g. ${INTENT_EXAMPLES[example]}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="onb-intent-count"
      />
      <p id="onb-intent-count" className="onb-count-line">
        {value.length}/{STARTING_INTENT_MAX}
      </p>
      <div className="onb-cta onb-cta--pair">
        <Button type="button" variant="quiet" onClick={onSkip}>
          Skip for now
        </Button>
        <Button type="submit" variant="primary" disabled={!has}>
          Start with this
        </Button>
      </div>
    </form>
  );
}

function ReadyStep({
  headingRef,
  draft,
  saving,
  error,
  onOpen,
  onChange,
}: {
  headingRef: HeadingRef;
  draft: OnboardingDraft;
  saving: boolean;
  error: string | null;
  onOpen: () => void;
  onChange: () => void;
}) {
  const lines = useMemo(() => readyLines(draft), [draft]);
  const summary = useMemo(
    () => readySummary(draft, draft.schoolMode === "set" ? parseSchoolHours(draft.school) : null),
    [draft]
  );
  return (
    <div className="onb-ready">
      <div className="onb-ready-mark" aria-hidden="true">
        <TangentLogo size={44} />
      </div>
      <StepHeading headingRef={headingRef} title="Your Tangent is ready." />
      <div className="onb-ready-lines">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {summary.length > 0 && (
        <dl className="onb-summary">
          {summary.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="onb-error" role="alert">
        {error ?? ""}
      </p>
      <div className="onb-cta onb-cta--pair">
        <Button type="button" variant="quiet" onClick={onChange} disabled={saving}>
          Change anything
        </Button>
        <Button type="button" variant="primary" onClick={onOpen} loading={saving} loadingLabel="Saving…">
          Open Tangent
        </Button>
      </div>
    </div>
  );
}
