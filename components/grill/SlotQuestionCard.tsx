"use client";

// "Grill until enough" (lib/context/flow.ts): one question at a time, with a
// bar for how much Tangent knows. Tap a chip, type an answer, skip it, or stop
// and plan with what Tangent has. After five in a row, the check-in card asks
// whether to keep going. Reuses the clarify card's styles.

import { useState } from "react";
import "@/components/console/clarify-card.css";
import "./slot-question.css";

export type SlotCard = { id: string; question: string; options: string[]; multi?: boolean; assume?: string };

type Props = {
  card: SlotCard;
  /** 0–1: how close Tangent is to knowing enough (0.7 drafts). */
  score: number;
  checkIn: boolean;
  disabled?: boolean;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
  /** Stop planning / Plan now: draft with what Tangent knows. */
  onStop: () => void;
  /** Keep going after a check-in. */
  onKeepGoing: () => void;
};

/** Tangent drafts at 0.7, so the bar reads 100% there. */
const percent = (score: number) => Math.max(0, Math.min(100, Math.round((score / 0.7) * 100)));

export default function SlotQuestionCard({ card, score, checkIn, disabled, onAnswer, onSkip, onStop, onKeepGoing }: Props) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const pct = percent(score);

  const bar = (
    <div className="slot-progress">
      <div className="slot-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Tangent knows enough">
        <div className="slot-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="slot-progress-label">Tangent knows enough: {pct}%</span>
    </div>
  );

  if (checkIn) {
    return (
      <div className="tg-clarify slot-card" role="group" aria-label="Keep going or plan now">
        {bar}
        <fieldset className="tg-clarify-q" disabled={disabled}>
          <legend>{card.question}</legend>
        </fieldset>
        <div className="tg-clarify-actions">
          <button type="button" className="tg-clarify-btn is-primary" onClick={onStop} disabled={disabled}>Plan now</button>
          <button type="button" className="tg-clarify-btn" onClick={onKeepGoing} disabled={disabled}>Keep going</button>
        </div>
      </div>
    );
  }

  const submitTyped = () => {
    const t = typed.trim();
    if (t) onAnswer(t);
  };

  return (
    <div className="tg-clarify slot-card" role="group" aria-label="Tangent's question">
      {bar}
      <fieldset className="tg-clarify-q" disabled={disabled}>
        <legend>{card.question}</legend>
        <div className="tg-clarify-options">
          {card.options.map((opt) => {
            const on = chosen.includes(opt) && !typing;
            return (
              <button
                key={opt}
                type="button"
                className={`tg-chip${on ? " is-on" : ""}`}
                aria-pressed={card.multi ? on : undefined}
                onClick={() => {
                  setTyping(false);
                  if (!card.multi) return onAnswer(opt);
                  setChosen((c) => (c.includes(opt) ? c.filter((o) => o !== opt) : [...c, opt]));
                }}
              >
                {opt}
              </button>
            );
          })}
          {typing ? (
            <input
              className="tg-chip-input"
              autoFocus
              placeholder="Type your answer"
              aria-label={`Your answer: ${card.question}`}
              value={typed}
              maxLength={200}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitTyped();
                }
                if (e.key === "Escape") setTyping(false);
              }}
            />
          ) : (
            <button type="button" className="tg-chip is-ghost" onClick={() => { setTyping(true); setChosen([]); }}>
              Type answer
            </button>
          )}
        </div>
        {card.assume && <p className="tg-clarify-assume">If you skip: {card.assume}</p>}
      </fieldset>
      <div className="tg-clarify-actions">
        {(card.multi && chosen.length > 0 && !typing) && (
          <button type="button" className="tg-clarify-btn is-primary" onClick={() => onAnswer(chosen.join(", "))} disabled={disabled}>
            Continue
          </button>
        )}
        {typing && (
          <button type="button" className="tg-clarify-btn is-primary" onClick={submitTyped} disabled={disabled || !typed.trim()}>
            Continue
          </button>
        )}
        <button type="button" className="tg-clarify-btn" onClick={onSkip} disabled={disabled}>Skip</button>
        <button type="button" className="tg-clarify-btn" onClick={onStop} disabled={disabled}>Stop planning</button>
      </div>
    </div>
  );
}
