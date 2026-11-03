"use client";

// Tangent's questions before it acts on a big or vague request (lib/ai/clarify.ts).
// Tap an answer, or type your own. Continue sends whatever is answered —
// skipping a question is fine. "Just do it" goes ahead with no answers.
// Master fix B6: a `multi` question's chips toggle ("All of these" stands
// alone) and the primary button counts them; an `instant` tap answers at once.

import { useState } from "react";
import { PICK_DATE, SKIP_ANSWER } from "@/lib/timeframe";
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

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClarifyCard({ questions, disabled, onSubmit, skipLabel = "Just do it", echo, initial, other = true }: Props) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [chosen, setChosen] = useState<Record<string, string[]>>(() => initial ?? {});
  const [dating, setDating] = useState<Record<string, boolean>>({});

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
        // A skipped question just isn't part of the answer.
        .filter((q) => answerOf(q) && answerOf(q) !== SKIP_ANSWER)
        .map((q) => ({ id: q.id, question: q.question, answer: answerOf(q) }))
    );

  const skip = (q: ClarifyQuestion) => {
    setDating((d) => ({ ...d, [q.id]: false }));
    setTyping((t) => ({ ...t, [q.id]: false }));
    // Alone on its card, Skip means go ahead now.
    if (questions.length === 1) return onSubmit([]);
    set(q.id, picked[q.id] === SKIP_ANSWER ? "" : SKIP_ANSWER);
  };

  const toggle = (q: ClarifyQuestion, opt: string) =>
    setChosen((c) => {
      const now = c[q.id] ?? [];
      if (now.includes(opt)) return { ...c, [q.id]: now.filter((o) => o !== opt) };
      return { ...c, [q.id]: opt === ALL ? [ALL] : [...now.filter((o) => o !== ALL), opt] };
    });

  return (
    <div className="tg-clarify" role="group" aria-label="Tangent's questions">
      {questions.map((q) => {
        const picksDate = q.options.includes(PICK_DATE);
        return (
        <fieldset key={q.id} className="tg-clarify-q" disabled={disabled}>
          <legend className={echo && q.question.trim() === echo.trim() ? "tg-clarify-sr" : undefined}>{q.question}</legend>
          <div className="tg-clarify-options">
            {q.options.map((opt) => {
              const on = opt === PICK_DATE ? !!dating[q.id] : (q.multi ? chosen[q.id]?.includes(opt) ?? false : picked[q.id] === opt) && !typing[q.id];
              return (
                <button
                  key={opt}
                  type="button"
                  className={`tg-chip${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => {
                    setTyping((t) => ({ ...t, [q.id]: false }));
                    setDating((d) => ({ ...d, [q.id]: opt === PICK_DATE ? !d[q.id] : false }));
                    if (opt === PICK_DATE) return set(q.id, "");
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
            ) : other && !picksDate && (
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
            {dating[q.id] && (
              <input
                className="tg-chip-input"
                type="date"
                autoFocus
                min={localToday()}
                aria-label={`Pick a date: ${q.question}`}
                value={picked[q.id] ?? ""}
                onChange={(e) => set(q.id, e.target.value)}
              />
            )}
            {!q.instant && !q.multi && (
              <button type="button" className={`tg-chip is-ghost${picked[q.id] === SKIP_ANSWER ? " is-on" : ""}`} aria-pressed={picked[q.id] === SKIP_ANSWER} onClick={() => skip(q)}>
                {SKIP_ANSWER}
              </button>
            )}
          </div>
          {q.assume && <p className="tg-clarify-assume">If you skip: {q.assume}</p>}
        </fieldset>
        );
      })}
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
            setDating({});
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
