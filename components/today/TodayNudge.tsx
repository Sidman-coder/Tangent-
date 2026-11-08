"use client";

// One quiet line from Tangent under the composer: questions it skipped asking,
// and how much setup is left. × hides it until tomorrow. Answer opens the
// questions in place; setup goes to Settings.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

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
  if (questionCount > 0) parts.push(`${questionCount} question${questionCount === 1 ? "" : "s"} to sharpen your plans`);
  if (setupLeft > 0) parts.push(`setup: ${setupLeft} step${setupLeft === 1 ? "" : "s"} left`);
  const text = parts.join(" · ");

  return (
    <div className="today-nudge" role="region" aria-label="From Tangent">
      <Sparkles size={16} strokeWidth={1.75} className="today-nudge-icon" aria-hidden="true" />
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
        <button type="button" className="today-nudge-hide" aria-label="Hide until tomorrow" title="Hide until tomorrow" onClick={hide}>
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
