"use client";

// One quiet line from Tangent under the composer: questions it skipped asking,
// and how much setup is left. × hides it until tomorrow. Answer opens the
// questions in place; setup goes to Settings.

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircleQuestion, X } from "lucide-react";

const HIDDEN_KEY = "tangent-home-nudge-hidden";

type Props = {
  today: string;
  questionCount: number;
  setupLeft: number;
  onAnswer: () => void;
};

export default function TodayNudge({ today, questionCount, setupLeft, onAnswer }: Props) {
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);
  useEffect(() => {
    try {
      setHiddenOn(window.localStorage.getItem(HIDDEN_KEY));
    } catch {}
  }, []);

  if (hiddenOn === today || (questionCount === 0 && setupLeft === 0)) return null;

  const hide = () => {
    setHiddenOn(today);
    try {
      window.localStorage.setItem(HIDDEN_KEY, today);
    } catch {}
  };

  const parts: string[] = [];
  // Overnight 2 (AI-JUDGMENT-1 #3): a growing count ("18 questions") reads as a
  // pile of homework. Past three it just says "a few".
  if (questionCount > 0) parts.push(questionCount === 1 ? "1 question to sharpen your plans" : questionCount <= 3 ? `${questionCount} questions to sharpen your plans` : "a few questions to sharpen your plans");
  if (setupLeft > 0) parts.push(`setup: ${setupLeft} step${setupLeft === 1 ? "" : "s"} left`);
  const text = parts.join(" · ");

  return (
    <div className="today-nudge" role="region" aria-label="From Tangent">
      <MessageCircleQuestion size={16} strokeWidth={1.75} className="today-nudge-icon" aria-hidden="true" />
      <p className="today-nudge-text">{text.charAt(0).toUpperCase() + text.slice(1)}</p>
      <div className="today-nudge-actions">
        {questionCount > 0 && (
          <button type="button" className="today-nudge-go" onClick={onAnswer}>
            Answer
          </button>
        )}
        {setupLeft > 0 && (
          <Link className="today-nudge-go" href="/settings/context">
            Finish setup
          </Link>
        )}
        {/* A visible name, not only an icon (overnight 2, N14). */}
        <button type="button" className="today-nudge-hide" title="Hide until tomorrow" onClick={hide}>
          <X size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>Hide</span>
          <span className="ui-visually-hidden"> until tomorrow</span>
        </button>
      </div>
    </div>
  );
}
