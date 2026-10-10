"use client";

// Tangent's questions before it acts on a big or vague request (lib/ai/clarify.ts).
// Tap an answer, or type your own. Continue sends whatever is answered —
// skipping a question is fine. "Just do it" goes ahead with no answers.

import { useState } from "react";
import "./clarify-card.css";

export type ClarifyQuestion = { id: string; question: string; options: string[] };
export type ClarifyAnswer = { id: string; question: string; answer: string };

type Props = {
  questions: ClarifyQuestion[];
  disabled?: boolean;
  /** null = skipped (no answers). */
  onSubmit: (answers: ClarifyAnswer[] | null) => void;
  /** "Just do it" when Tangent is waiting to act; "Later" when the task is
   *  already saved and the questions can wait. */
  skipLabel?: string;
};

export default function ClarifyCard({ questions, disabled, onSubmit, skipLabel = "Just do it" }: Props) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});

  const set = (id: string, value: string) => setPicked((p) => ({ ...p, [id]: value }));
  const answered = questions.filter((q) => picked[q.id]?.trim()).length;

  const submit = () =>
    onSubmit(
      questions
        .filter((q) => picked[q.id]?.trim())
        .map((q) => ({ id: q.id, question: q.question, answer: picked[q.id].trim() }))
    );

  return (
    <div className="tg-clarify" role="group" aria-label="Tangent's questions">
      {questions.map((q) => (
        <fieldset key={q.id} className="tg-clarify-q" disabled={disabled}>
          <legend>{q.question}</legend>
          <div className="tg-clarify-options">
            {q.options.map((opt) => {
              const on = picked[q.id] === opt && !typing[q.id];
              return (
                <button
                  key={opt}
                  type="button"
                  className={`tg-chip${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setTyping((t) => ({ ...t, [q.id]: false }));
                    set(q.id, on ? "" : opt);
                  }}
                >
                  {opt}
                </button>
              );
            })}
            {typing[q.id] ? (
              <input
                className="tg-chip-input"
                autoFocus
                placeholder="Type your answer"
                aria-label={`Your answer: ${q.question}`}
                value={picked[q.id] ?? ""}
                onChange={(e) => set(q.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="tg-chip is-ghost"
                onClick={() => {
                  setTyping((t) => ({ ...t, [q.id]: true }));
                  set(q.id, "");
                }}
              >
                Other…
              </button>
            )}
          </div>
        </fieldset>
      ))}
      <div className="tg-clarify-actions">
        <button type="button" className="tg-clarify-btn is-primary" onClick={submit} disabled={disabled || answered === 0}>
          Continue
        </button>
        <button type="button" className="tg-clarify-btn" onClick={() => onSubmit(null)} disabled={disabled}>
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
