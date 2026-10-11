"use client";

// "Tangent has a question" on Today. Quiet by default: one line with a count.
// Open it and answer one set at a time; Later leaves it here, Don't ask drops
// it. Answers sharpen the task and teach Tangent about the student.

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import ActionReceipt from "@/components/ActionReceipt";
import ClarifyCard from "@/components/console/ClarifyCard";
import { answerQuestions, dismissQuestions, type QuestionSet } from "@/lib/questions-client";
import { spring } from "@/lib/motion";
import "./questions-inbox.css";

type Props = { sets: QuestionSet[]; onChanged: () => void };

export default function QuestionsInbox({ sets, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: string; actionId?: string } | null>(null);

  // The bell's "Answer" lands here as /#questions: open straight to them.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === "#questions") setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  const current = sets[0];
  if (!current && !result) return null;

  const count = sets.reduce((n, s) => n + s.questions.length, 0);

  return (
    <section id="questions" className="today-questions" aria-label="Questions from Tangent">
      <button
        type="button"
        className="today-questions-head"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setResult(null);
        }}
      >
        <span className="today-questions-dot" aria-hidden="true" />
        <span className="today-questions-title">
          {current ? `${count} question${count === 1 ? "" : "s"} from Tangent` : "All caught up"}
        </span>
        <span className="today-questions-cta">{open ? "Close" : "Answer"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            className="today-questions-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: spring.soft }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
          >
            {result && (
              <div className="today-questions-result">
                {result.actionId ? (
                  <ActionReceipt actionId={result.actionId} label={result.summary} onUndone={onChanged} />
                ) : (
                  <p>{result.summary}</p>
                )}
              </div>
            )}
            {current && (
              <div key={current.id}>
                <p className="today-questions-about">
                  About <strong>{current.taskTitle}</strong>
                </p>
                <ClarifyCard
                  questions={current.questions}
                  disabled={busy}
                  skipLabel="Later"
                  onSubmit={async (answers) => {
                    if (!answers) {
                      setOpen(false);
                      return;
                    }
                    setBusy(true);
                    const r = await answerQuestions(current.id, answers);
                    setBusy(false);
                    setResult({ summary: r.error ?? r.summary ?? "Saved.", actionId: r.actionId });
                    onChanged();
                  }}
                />
                <button
                  type="button"
                  className="today-questions-drop"
                  disabled={busy}
                  onClick={async () => {
                    await dismissQuestions(current.id);
                    onChanged();
                  }}
                >
                  Don&apos;t ask about this
                </button>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
