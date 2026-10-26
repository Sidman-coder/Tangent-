"use client";

// The frosted card that rises above the island after a capture: where it went,
// then one question at a time (this capture's own, or one parked earlier), or
// Undo. Dismissing it never unsaves anything; unanswered questions wait in
// the pile (Today and the bell read the same /api/questions sets).

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import ActionReceipt from "@/components/ActionReceipt";
import PreviewCard from "@/components/PreviewCard";
import { answerQuestions, type QuestionSet } from "@/lib/questions-client";
import type { CaptureOutcome } from "@/lib/capture-outcome";

const AUTO_DISMISS_MS = 3200;

type Props = {
  outcome: CaptureOutcome;
  /** This capture's own questions, once /api/questions has written them. */
  freshSet: QuestionSet | null;
  questionsPending: boolean;
  /** The oldest question set already waiting, offered when this capture has none. */
  parkedSet: QuestionSet | null;
  line: { title: string; color: string } | null;
  onDismiss: () => void;
  onRetry: (said: string) => void;
  onConfirm: (id: string, yes: boolean) => void;
  onAsk: (said: string) => void;
  onChanged: () => void;
};

export default function SortedCard({ outcome, freshSet, questionsPending, parkedSet, line, onDismiss, onRetry, onConfirm, onAsk, onChanged }: Props) {
  const reduced = useReducedMotion();
  const set = outcome.kind === "saved" ? freshSet ?? (questionsPending ? null : parkedSet) : null;
  const parked = Boolean(set && set !== freshSet);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [thanks, setThanks] = useState(false);

  // A different set (questions just landed): start it from the top.
  useEffect(() => {
    setStep(0);
    setAnswers([]);
  }, [set?.id]);

  const settles = outcome.kind === "saved" && !set && !questionsPending;
  useEffect(() => {
    const nothingToResend = outcome.kind === "error" && !outcome.said;
    if (!settles && !thanks && outcome.kind !== "duplicate" && !nothingToResend) return;
    const t = window.setTimeout(onDismiss, thanks ? 1400 : AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [settles, thanks, outcome, onDismiss]);

  const question = set?.questions[step];
  const answer = (choice: string) => {
    if (!set || !question) return;
    const next = [...answers, { id: question.id, question: question.question, answer: choice }];
    if (step + 1 < set.questions.length) {
      setAnswers(next);
      setStep(step + 1);
      return;
    }
    setThanks(true);
    void answerQuestions(set.id, next).then(onChanged);
  };

  const enter = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 20, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, visualDuration: 0.42, bounce: 0.28 } },
        exit: { opacity: 0, y: 14, scale: 0.97, transition: { duration: 0.18 } },
      };
  const lineIn = (i: number) =>
    reduced
      ? {}
      : { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0, transition: { delay: 0.1 + i * 0.12, type: "spring" as const, visualDuration: 0.4, bounce: 0 } } };

  const body = useMemo(() => {
    switch (outcome.kind) {
      case "duplicate":
        return <p className="sorted-text">{outcome.summary}</p>;
      case "confirm":
        return (
          <>
            <p className="sorted-text">{outcome.message}</p>
            <div className="sorted-chips">
              <button type="button" className="capture-chip is-primary" onClick={() => onConfirm(outcome.id, true)}>Yes</button>
              <button type="button" className="capture-chip" onClick={() => onConfirm(outcome.id, false)}>No</button>
            </div>
          </>
        );
      case "preview":
        return <PreviewCard changeSet={outcome.changeSet} preview={outcome.preview} onChanged={onChanged} onSettled={onDismiss} />;
      case "question":
        return (
          <>
            <p className="sorted-text">Sounds like a question.</p>
            <div className="sorted-chips">
              <button type="button" className="capture-chip is-primary" onClick={() => onAsk(outcome.said)}>Ask Tangent →</button>
            </div>
          </>
        );
      case "unsure":
        return (
          <>
            <p className="sorted-text">“{outcome.said.replace(/[.!?]+$/, "")}” didn&apos;t sound like something to do.</p>
            <div className="sorted-chips">
              <button type="button" className="capture-chip is-primary" onClick={() => onRetry(outcome.said)}>Add it anyway</button>
              <button type="button" className="capture-chip is-quiet" onClick={onDismiss}>No, never mind</button>
            </div>
          </>
        );
      case "error":
        if (!outcome.said) return <p className="sorted-text">{outcome.message}</p>;
        return (
          <button type="button" className="sorted-retry" onClick={() => outcome.said && onRetry(outcome.said)}>
            Couldn&apos;t add that, try again
          </button>
        );
      case "saved":
        return null;
    }
  }, [outcome, onAsk, onChanged, onConfirm, onDismiss, onRetry]);

  return (
    <>
      {/* Tap anywhere else to put it away. */}
      <div className="sorted-catcher" onPointerDown={onDismiss} aria-hidden="true" />
      <m.section
        className="sorted-card"
        role="status"
        aria-live="polite"
        {...enter}
        drag={reduced ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 60 || info.velocity.y > 500) onDismiss();
        }}
      >
        <p className="sorted-label">{outcome.kind === "error" ? "Not added" : outcome.kind === "unsure" ? "Did I hear that right?" : "Sorted"}</p>
        {outcome.kind === "saved" && (
          <m.div className="sorted-line" {...lineIn(0)}>
            <i style={{ background: line?.color ?? "var(--cat-other)" }} aria-hidden="true" />
            <b>{line?.title ?? outcome.summary}</b>
            <span>→ {outcome.where}</span>
          </m.div>
        )}
        {body}
        {outcome.kind === "saved" && (
          <m.div className="sorted-after" {...lineIn(1)}>
            {thanks ? (
              <p className="sorted-text">Got it.</p>
            ) : set && question ? (
              <>
                <p className="sorted-question">
                  {parked && step === 0 && (
                    <>
                      Earlier you added <em>{set.taskTitle}</em>:{" "}
                    </>
                  )}
                  {question.question}
                </p>
                <div className="sorted-chips">
                  {question.options.map((o) => (
                    <button key={o} type="button" className="capture-chip" onClick={() => answer(o)}>
                      {o}
                    </button>
                  ))}
                  <button type="button" className="capture-chip is-quiet" onClick={onDismiss}>
                    {parked ? "Later" : "Ask me later"}
                  </button>
                </div>
              </>
            ) : outcome.actionId ? (
              <ActionReceipt actionId={outcome.actionId} label={outcome.summary} onUndone={() => { onChanged(); onDismiss(); }} />
            ) : null}
          </m.div>
        )}
      </m.section>
    </>
  );
}
