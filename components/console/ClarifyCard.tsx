"use client";

// Tangent's questions before it acts on a big or vague request (lib/ai/clarify.ts).
// Tap an answer, or type your own. Continue sends whatever is answered —
// skipping a question is fine. "Just do it" goes ahead with no answers.
// Master fix B6: a `multi` question's chips toggle ("All of these" stands
// alone) and the primary button counts them; an `instant` tap answers at once.

import { useState } from "react";
import "./clarify-card.css";

export type ClarifyQuestion = {
  id: string;
  question: string;
  options: string[];
  multi?: boolean;
  instant?: boolean;
  submitLabel?: string;
  /** What Tangent goes with if this is skipped (Master fix Phase 3). */
  assume?: string;
};

/** lib/pending-question.ts ALL_OF_THESE: selects every other chip's plan. */
const ALL = "All of these";
export type ClarifyAnswer = { id: string; question: string; answer: string };

type Props = {
  questions: ClarifyQuestion[];
  disabled?: boolean;
  /** null = skipped (no answers). */
  onSubmit: (answers: ClarifyAnswer[] | null) => void;
  /** "Just do it" when Tangent is waiting to act; "Later" when the task is
   *  already saved and the questions can wait. */
  skipLabel?: string;
  /** The reply text right above the card: a question repeating it is kept
   *  for screen readers only, so it isn't shown twice (master fix B2). */
  echo?: string;
  /** Master fix Phase 5: chips a multi question starts with (the calendar's
   *  Remove picks the clicked task). */
  initial?: Record<string, string[]>;
  /** false: no "Other…" typed answer (a pick from a fixed list). */
  other?: boolean;
};

export default function ClarifyCard({ questions, disabled, onSubmit, skipLabel = "Just do it", echo, initial, other = true }: Props) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [chosen, setChosen] = useState<Record<string, string[]>>(() => initial ?? {});

  const set = (id: string, value: string) => setPicked((p) => ({ ...p, [id]: value }));
  // A multi question's answer: typed text, else its chips ("A, B" or "All of these").
  const answerOf = (q: ClarifyQuestion) =>
    q.multi && !typing[q.id] ? (chosen[q.id]?.includes(ALL) ? ALL : (chosen[q.id] ?? []).join(", ")) : picked[q.id]?.trim() ?? "";
  const answered = questions.filter((q) => answerOf(q)).length;
  const multi = questions.find((q) => q.multi && !typing[q.id]);
  const count = multi ? (chosen[multi.id]?.includes(ALL) ? multi.options.filter((o) => o !== ALL).length : chosen[multi.id]?.length ?? 0) : 0;
  const label = multi?.submitLabel ? (count ? `${multi.submitLabel} (${count})` : multi.submitLabel) : "Continue";
  // An instant card's chips are its buttons; Continue only for a typed answer.
  const showContinue = !questions.every((q) => q.instant) || questions.some((q) => typing[q.id]);

  const submit = () =>
    onSubmit(
      questions
        .filter((q) => answerOf(q))
        .map((q) => ({ id: q.id, question: q.question, answer: answerOf(q) }))
    );

  const toggle = (q: ClarifyQuestion, opt: string) =>
    setChosen((c) => {
      const now = c[q.id] ?? [];
      if (now.includes(opt)) return { ...c, [q.id]: now.filter((o) => o !== opt) };
      return { ...c, [q.id]: opt === ALL ? [ALL] : [...now.filter((o) => o !== ALL), opt] };
    });

  return (
    <div className="tg-clarify" role="group" aria-label="Tangent's questions">
      {questions.map((q) => (
        <fieldset key={q.id} className="tg-clarify-q" disabled={disabled}>
          <legend className={echo && q.question.trim() === echo.trim() ? "tg-clarify-sr" : undefined}>{q.question}</legend>
          <div className="tg-clarify-options">
            {q.options.map((opt) => {
              const on = (q.multi ? chosen[q.id]?.includes(opt) ?? false : picked[q.id] === opt) && !typing[q.id];
              return (
                <button
                  key={opt}
                  type="button"
                  className={`tg-chip${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setTyping((t) => ({ ...t, [q.id]: false }));
                    if (q.instant) return onSubmit([{ id: q.id, question: q.question, answer: opt }]);
                    if (q.multi) return toggle(q, opt);
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
            ) : other && (
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
          {q.assume && <p className="tg-clarify-assume">If you skip: {q.assume}</p>}
        </fieldset>
      ))}
      <div className="tg-clarify-actions">
        {showContinue && (
          <button type="button" className="tg-clarify-btn is-primary" onClick={submit} disabled={disabled || answered === 0}>
            {label}
          </button>
        )}
        <button
          type="button"
          className="tg-clarify-btn"
          onClick={() => {
            setChosen({});
            setPicked({});
            setTyping({});
            onSubmit(null);
          }}
          disabled={disabled}
        >
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
