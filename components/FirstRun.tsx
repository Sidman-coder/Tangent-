"use client";

// The first-run flow (Round 4 Phase 6: deeper, not longer). Eight questions,
// then the ready screen. Every answer lives in a local draft (saved to
// localStorage per student, so Back keeps it and a refresh resumes it) until
// "Open Tangent", which is the one server save; the server turns the answers
// into facts the student said (lib/onboarding-facts.ts) and the commitments
// into busy blocks on the calendar. Questions and copy: lib/onboarding.ts.

import "./FirstRun.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import TangentLogo from "@/components/TangentLogo";
import Button from "@/components/ui/Button";
import CommitmentsList from "@/components/schedule/CommitmentsList";
import { useAppState } from "@/components/AppStateProvider";
import { browserTimezone } from "@/lib/time";
import { requestHomePlan } from "@/lib/home-intent";
import { AGE_OPTIONS, ageStorageKey } from "@/lib/auth/age";
import { DISTRESS_REPLY, looksDistressed } from "@/lib/student/sensitive";
import type { Commitment } from "@/lib/commitments";
import {
  BEST_TIME_OPTIONS,
  DISPLAY_NAME_MAX,
  FOCUS_LENGTH_OPTIONS,
  GRADE_OPTIONS,
  MATTER_OPTIONS,
  MAX_SLIPS,
  MORE_MAX,
  PUSH_OPTIONS,
  SCHOOL_NIGHT_OPTIONS,
  SHORT_TEXT_MAX,
  SLIP_OPTIONS,
  STARTING_INTENT_MAX,
  STEPS,
  answersFromDraft,
  canContinue,
  draftFromSaved,
  draftStorageKey,
  emptyDraft,
  hasAnswer,
  parseStoredDraft,
  readyLines,
  readySummary,
  resumeStep,
  serializeDraft,
  submissionFromDraft,
  toggleSlip,
  type Choice,
  type OnboardingDraft,
  type QuestionStep,
  type StepId,
} from "@/lib/onboarding";

/** Long enough to see the selection land before the next question. */
const AUTO_ADVANCE_MS = 260;

/** What each "Tell me more" invites. */
const MORE_PROMPTS: Record<QuestionStep, string> = {
  about: "Anything you'd like Tangent to know about you",
  busy: "e.g. Practice moves around during playoffs",
  matters: "Why it matters, or what would make this year a win",
  slip: "What does it look like when it happens?",
  bugging: "What's making it hard to start?",
  brain: "e.g. I focus better at the library, or with music on",
  toward: "What got you interested?",
  push: "e.g. Don't bug me on weekends",
};

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

  // Resume an unfinished draft; otherwise start from saved answers (Redo
  // setup) or from nothing.
  const [initial] = useState(() => {
    const stored = parseStoredDraft(readStorage(storageKey));
    if (stored) return { step: resumeStep(stored.step, stored.draft), draft: stored.draft };
    const draft = user
      ? draftFromSaved({ displayName: user.displayName, preferences: user, onboarded: !!user.onboardedAt })
      : emptyDraft();
    return { step: STEPS[0], draft };
  });
  const [step, setStep] = useState<StepId>(initial.step);
  const [draft, setDraft] = useState<OnboardingDraft>(initial.draft);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Age is asked on the first screen, once per device: a finished setup (Redo
  // setup) or an earlier "13 or older" skips it. Under 13 goes to a friendly
  // stop screen (/api/age says where).
  const ageKey = ageStorageKey(user?.email || "anonymous");
  const [ageOk, setAgeOk] = useState(() => !!user?.onboardedAt || readStorage(ageKey) === "yes");

  useEffect(() => {
    writeStorage(storageKey, serializeDraft(step, draft));
  }, [storageKey, step, draft]);

  const index = STEPS.indexOf(step);
  const questionCount = STEPS.length - 1; // the ready screen isn't a question
  const progress = step === "ready" ? 1 : index / questionCount;

  const goTo = useCallback(
    (next: StepId) => {
      setDirection(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 1 : -1);
      setStep(next);
    },
    [step]
  );

  // Pending auto-advance after a single choice (see chooseAndAdvance).
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const next = useCallback(() => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) goTo(STEPS[i + 1]);
  }, [step, goTo]);

  const back = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (index > 0) goTo(STEPS[index - 1]);
  };

  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setMore = (s: QuestionStep, text: string) => setDraft((d) => ({ ...d, more: { ...d.more, [s]: text } }));

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);
  const chooseAndAdvance = (patch: Partial<OnboardingDraft>) => {
    update(patch);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(next, AUTO_ADVANCE_MS);
  };

  // Redo setup: the busy blocks already on the calendar fill the list, so
  // saving without touching it keeps them. Until they load the submission
  // sends no commitments, which leaves the calendar alone.
  const [commitmentsLoad, setCommitmentsLoad] = useState<"idle" | "loading" | "failed">("idle");
  useEffect(() => {
    if (step !== "busy" || draft.commitmentsKnown || commitmentsLoad !== "idle") return;
    setCommitmentsLoad("loading");
    fetch("/api/commitments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; commitments?: Commitment[] }) => {
        if (!d.ok || !Array.isArray(d.commitments)) throw new Error("load");
        setDraft((cur) => (cur.commitmentsKnown ? cur : { ...cur, commitments: d.commitments ?? [], commitmentsKnown: true }));
        setCommitmentsLoad("idle");
      })
      .catch(() => setCommitmentsLoad("failed"));
  }, [step, draft.commitmentsKnown, commitmentsLoad]);

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
      const body = submissionFromDraft(draft, { timezone: browserTimezone() });
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Couldn't save your setup. Try again.");
      writeStorage(storageKey, null);
      // What's bugging them starts planning on Home (in its composer,
      // questions skippable), never a task.
      if (body.preferences.startingIntent) requestHomePlan(body.preferences.startingIntent, true);
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

  // Shared by the optional questions: Skip until something's answered, then
  // Continue. Never blocks.
  const actions = (s: QuestionStep) => ({
    answered: hasAnswer(s, draft),
    ready: canContinue(s, draft),
    onNext: next,
  });
  const more = (s: QuestionStep) => (
    <TellMeMore id={`onb-more-${s}`} prompt={MORE_PROMPTS[s]} value={draft.more[s] ?? ""} onChange={(t) => setMore(s, t)} />
  );

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
            {step === "about" && (
              <AboutStep
                headingRef={headingRef}
                draft={draft}
                askAge={!ageOk}
                onChange={update}
                more={more("about")}
                onDone={() => {
                  if (!ageOk) {
                    writeStorage(ageKey, "yes");
                    setAgeOk(true);
                  }
                  next();
                }}
              />
            )}

            {step === "busy" && (
              <Question
                headingRef={headingRef}
                title="When are you already busy?"
                sub="School, practice, work, anything that repeats. Tangent won't plan on top of it."
                {...actions("busy")}
              >
                {!draft.commitmentsKnown && commitmentsLoad !== "failed" ? (
                  <p className="onb-hint-line">Loading what you already have…</p>
                ) : (
                  <>
                    {commitmentsLoad === "failed" && !draft.commitmentsKnown && (
                      <p className="onb-hint-line">
                        Couldn&apos;t load what you already have. If you leave this alone, your calendar stays as it is.
                      </p>
                    )}
                    <CommitmentsList
                      idPrefix="onb-cmt"
                      value={draft.commitments}
                      onChange={(commitments) => update({ commitments, commitmentsKnown: true })}
                    />
                  </>
                )}
                {more("busy")}
              </Question>
            )}

            {step === "matters" && (
              <Question headingRef={headingRef} title="What matters most to you this year?" sub="Pick as many as you like." {...actions("matters")}>
                <ChipToggles
                  label="What matters most this year"
                  options={MATTER_OPTIONS}
                  value={draft.matters}
                  onToggle={(v) =>
                    update({ matters: draft.matters.includes(v) ? draft.matters.filter((x) => x !== v) : [...draft.matters, v] })
                  }
                />
                <div className="onb-field">
                  <label className="onb-label" htmlFor="onb-matters-text">
                    Something else?
                  </label>
                  <input
                    id="onb-matters-text"
                    className="onb-input"
                    type="text"
                    maxLength={MORE_MAX}
                    placeholder="e.g. Getting my license"
                    value={draft.mattersText}
                    onChange={(e) => update({ mattersText: e.target.value })}
                  />
                </div>
                {more("matters")}
              </Question>
            )}

            {step === "slip" && (
              <Question
                headingRef={headingRef}
                title="When things slip, what usually happens?"
                sub={`Pick up to ${MAX_SLIPS}. No judgment, everyone has one.`}
                {...actions("slip")}
              >
                <div className="onb-choices" role="group" aria-label="When things slip">
                  {SLIP_OPTIONS.map((o) => {
                    const on = draft.slips.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        className={`onb-choice${on ? " is-on" : ""}`}
                        onClick={() => update({ slips: toggleSlip(draft.slips, o.value) })}
                      >
                        <span className="onb-choice-text">
                          <span className="onb-choice-label">{o.label}</span>
                        </span>
                        <span className="onb-choice-check" aria-hidden="true">
                          {on && <Check size={14} strokeWidth={2.4} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {more("slip")}
              </Question>
            )}

            {step === "bugging" && (
              <Question
                headingRef={headingRef}
                title="What's bugging you most right now?"
                sub="The thing you keep thinking about but haven't started."
                {...actions("bugging")}
              >
                <label className="onb-sr" htmlFor="onb-bugging">
                  What&apos;s bugging you most right now
                </label>
                <textarea
                  id="onb-bugging"
                  className="onb-input onb-textarea"
                  rows={2}
                  maxLength={STARTING_INTENT_MAX}
                  placeholder="e.g. My history essay, or studying for the SAT"
                  value={draft.bugging}
                  onChange={(e) => update({ bugging: e.target.value })}
                  aria-describedby="onb-bugging-count"
                />
                <p id="onb-bugging-count" className="onb-count-line">
                  {draft.bugging.length}/{STARTING_INTENT_MAX}
                </p>
                {more("bugging")}
              </Question>
            )}

            {step === "brain" && (
              <Question headingRef={headingRef} title="How does your brain work best?" sub="Rough guesses are fine." {...actions("brain")}>
                <ChipRadio
                  label="When do you think best?"
                  options={BEST_TIME_OPTIONS}
                  value={draft.bestTime}
                  onChoose={(bestTime) => update({ bestTime })}
                />
                <ChipRadio
                  label="How long can you focus before you need a break?"
                  options={FOCUS_LENGTH_OPTIONS}
                  value={draft.focusLength}
                  onChoose={(focusLength) => update({ focusLength })}
                />
                <ChipRadio
                  label="How much can you get done on a school night?"
                  options={SCHOOL_NIGHT_OPTIONS}
                  value={draft.schoolNightHours}
                  onChoose={(schoolNightHours) => update({ schoolNightHours })}
                />
                {more("brain")}
              </Question>
            )}

            {step === "toward" && (
              <Question
                headingRef={headingRef}
                title="What are you building toward?"
                sub="Fill in any of these, or none. Not sure yet is a real answer."
                {...actions("toward")}
              >
                <TowardFields value={draft.toward} onChange={(toward) => update({ toward })} />
                {more("toward")}
              </Question>
            )}

            {step === "push" && (
              <Question headingRef={headingRef} title="How should Tangent push you?" {...actions("push")}>
                <ChoiceCards
                  label="How should Tangent push you?"
                  options={PUSH_OPTIONS}
                  value={draft.push}
                  onChoose={(push) => (draft.more.push?.trim() ? update({ push }) : chooseAndAdvance({ push }))}
                />
                {more("push")}
              </Question>
            )}

            {step === "ready" && (
              <ReadyStep
                headingRef={headingRef}
                draft={draft}
                saving={saving}
                error={saveError}
                onOpen={() => void finish()}
                onChange={() => goTo("about")}
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

/** An optional question: Enter or the button moves on. Skip until something's
 *  answered, then Continue (held back only by a half-finished answer). */
function Question({
  headingRef,
  title,
  sub,
  answered,
  ready,
  onNext,
  children,
}: {
  headingRef: HeadingRef;
  title: string;
  sub?: string;
  answered: boolean;
  ready: boolean;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="onb-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!answered || ready) onNext();
      }}
    >
      <StepHeading headingRef={headingRef} title={title} sub={sub} />
      {children}
      <div className="onb-cta">
        {answered ? (
          <Button type="submit" variant="primary" disabled={!ready}>
            Continue
          </Button>
        ) : (
          <Button type="submit" variant="secondary">
            Skip
          </Button>
        )}
      </div>
    </form>
  );
}

/** "Tell me more": closed by default so the screen stays short; open (and
 *  kept open) once there's something in it. */
function TellMeMore({
  id,
  prompt,
  value,
  onChange,
}: {
  id: string;
  prompt: string;
  value: string;
  onChange: (text: string) => void;
}) {
  const [open, setOpen] = useState(() => value.trim().length > 0);
  const [focusOnOpen, setFocusOnOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (open && focusOnOpen) ref.current?.focus();
  }, [open, focusOnOpen]);

  if (!open) {
    return (
      <button
        type="button"
        className="onb-more-toggle"
        aria-expanded={false}
        onClick={() => {
          setFocusOnOpen(true);
          setOpen(true);
        }}
      >
        <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
        Tell me more
      </button>
    );
  }
  return (
    <div className="onb-field">
      <label className="onb-label" htmlFor={id}>
        Tell me more <span className="onb-optional">optional</span>
      </label>
      <textarea
        ref={ref}
        id={id}
        className="onb-input onb-textarea"
        rows={3}
        maxLength={MORE_MAX}
        placeholder={prompt}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AboutStep({
  headingRef,
  draft,
  askAge,
  onChange,
  more,
  onDone,
}: {
  headingRef: HeadingRef;
  draft: OnboardingDraft;
  askAge: boolean;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  more: React.ReactNode;
  onDone: () => void;
}) {
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = canContinue("about", draft) && (!askAge || age !== "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    if (!askAge) return onDone();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age: Number(age) }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; next?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Couldn't save that. Try again.");
      if (data.next) {
        window.location.replace(data.next);
        return;
      }
      setBusy(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      setBusy(false);
    }
  };

  return (
    <form className="onb-form" onSubmit={submit}>
      <StepHeading
        headingRef={headingRef}
        title="Hey, I'm Tangent. Who are you?"
        sub="A few quick questions so your plans fit your real life. Only your name is required."
      />
      <div className="onb-field">
        <label className="onb-label" htmlFor="onb-name">
          First name
        </label>
        <input
          id="onb-name"
          className="onb-input"
          type="text"
          autoComplete="given-name"
          maxLength={DISPLAY_NAME_MAX}
          placeholder="What should we call you?"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      {askAge && (
        <div className="onb-field">
          <label className="onb-label" htmlFor="onb-age">
            How old are you?
          </label>
          <select id="onb-age" className="onb-input" value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="" disabled>
              Choose your age
            </option>
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <ChipRadio label="What grade are you in?" options={GRADE_OPTIONS} value={draft.grade} onChoose={(grade) => onChange({ grade })} />
      {more}
      <p className="onb-error" role="alert">
        {error ?? ""}
      </p>
      <div className="onb-cta">
        <Button type="submit" variant="primary" disabled={!ready} loading={busy} loadingLabel="Saving…">
          Continue
        </Button>
      </div>
    </form>
  );
}

function TowardFields({
  value,
  onChange,
}: {
  value: OnboardingDraft["toward"];
  onChange: (next: OnboardingDraft["toward"]) => void;
}) {
  const set = (patch: Partial<OnboardingDraft["toward"]>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="onb-pair">
        <div className="onb-field">
          <label className="onb-label" htmlFor="onb-major">
            A major you&apos;re curious about
          </label>
          <input
            id="onb-major"
            className="onb-input"
            type="text"
            maxLength={SHORT_TEXT_MAX}
            placeholder="e.g. Biology"
            value={value.major}
            onChange={(e) => set({ major: e.target.value })}
          />
        </div>
        <div className="onb-field">
          <label className="onb-label" htmlFor="onb-career">
            A job you could see yourself doing
          </label>
          <input
            id="onb-career"
            className="onb-input"
            type="text"
            maxLength={SHORT_TEXT_MAX}
            placeholder="e.g. Nurse, game designer"
            value={value.career}
            onChange={(e) => set({ career: e.target.value })}
          />
        </div>
      </div>
      <div className="onb-field">
        <label className="onb-label" htmlFor="onb-dream">
          A dream, big or small
        </label>
        <input
          id="onb-dream"
          className="onb-input"
          type="text"
          maxLength={MORE_MAX}
          placeholder="e.g. Open my own bakery"
          value={value.dream}
          onChange={(e) => set({ dream: e.target.value })}
        />
      </div>
      <div className="onb-chips">
        <button
          type="button"
          className={`onb-chip${value.notSure ? " is-on" : ""}`}
          aria-pressed={value.notSure}
          onClick={() => set({ notSure: !value.notSure })}
        >
          {value.notSure && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
          Not sure yet
        </button>
      </div>
    </>
  );
}

/** Roving focus for a row of radio buttons: arrows move, Enter/Space choose. */
function useRoving(count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    refs.current[(i + delta + count) % count]?.focus();
  };
  const bind = (i: number) => (el: HTMLButtonElement | null) => {
    refs.current[i] = el;
  };
  return { bind, onKeyDown };
}

/** Big single-choice cards (the push question). */
function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChoose,
}: {
  label: string;
  options: Choice<T>[];
  value: T | null;
  onChoose: (v: T) => void;
}) {
  const { bind, onKeyDown } = useRoving(options.length);
  const selected = options.findIndex((o) => o.value === value);
  return (
    <div className="onb-choices" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={bind(i)}
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
  );
}

/** A labelled row of single-choice chips (grade, the brain questions).
 *  Choosing the picked chip again clears it. */
function ChipRadio<T extends string>({
  label,
  options,
  value,
  onChoose,
}: {
  label: string;
  options: Choice<T>[];
  value: T | null;
  onChoose: (v: T | null) => void;
}) {
  const { bind, onKeyDown } = useRoving(options.length);
  const selected = options.findIndex((o) => o.value === value);
  return (
    <div className="onb-group">
      <span className="onb-label" aria-hidden="true">
        {label}
      </span>
      <div className="onb-chips" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={bind(i)}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === (selected >= 0 ? selected : 0) ? 0 : -1}
              className={`onb-chip${on ? " is-on" : ""}`}
              onClick={() => onChoose(on ? null : o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-select chips (what matters this year). */
function ChipToggles<T extends string>({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: Choice<T>[];
  value: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="onb-chips" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            className={`onb-chip${on ? " is-on" : ""}`}
            onClick={() => onToggle(o.value)}
          >
            {on && <Check size={14} strokeWidth={2.4} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
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
  const answers = useMemo(() => answersFromDraft(draft), [draft]);
  const lines = useMemo(() => readyLines(answers), [answers]);
  const summary = useMemo(() => readySummary(answers), [answers]);
  const name = draft.name.trim();
  // Real distress in "what's bugging you" never becomes a plan; it gets a
  // kind word instead (lib/student/sensitive.ts).
  const distressed = looksDistressed(draft.bugging);
  return (
    <div className="onb-ready">
      <div className="onb-ready-mark" aria-hidden="true">
        <TangentLogo size={44} />
      </div>
      <StepHeading headingRef={headingRef} title={name ? `You're all set, ${name}.` : "Your Tangent is ready."} />
      {distressed && (
        <p className="onb-note" role="note">
          {DISTRESS_REPLY}
        </p>
      )}
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
