"use client";

// Round 5A 2.1: a talk with Tangent. The student's words sit on the right in a
// bubble; Tangent's answer is plain markdown with no bubble, written in as it
// streams. A goal answer can end with "Plan this into my calendar"; the
// brief's one question says it can be skipped.

import Markdown from "@/components/console/Markdown";
import "@/components/console/chat-ux.css";
import PlanThisRow from "./PlanThisRow";
import BusyTimeOffer from "./BusyTimeOffer";
import "./talk.css";

export type TalkLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Still arriving. */
  streaming?: boolean;
  /** An answer about a goal: the words "Plan this" will plan. */
  planGoal?: string;
  /** The brief's one question before planning (lib/ai/plan-brief-call.ts). */
  planQuestion?: boolean;
  /** "Plan this into my calendar" still shows under it. */
  offerPlan?: boolean;
};

export default function TalkThread({
  lines,
  busy,
  onPlanThis,
  onNotNow,
  onSkipQuestion,
  compact = false,
}: {
  lines: TalkLine[];
  busy?: boolean;
  onPlanThis?: (line: TalkLine) => void;
  onNotNow?: (line: TalkLine) => void;
  onSkipQuestion?: (line: TalkLine) => void;
  compact?: boolean;
}) {
  const last = lines[lines.length - 1];
  return (
    <ol className={`talk-thread${compact ? " is-compact" : ""}`} aria-label="Your talk with Tangent">
      {lines.map((l, i) => (
        <li key={l.id} className={`talk-line is-${l.role}`} aria-busy={l.streaming || undefined}>
          {l.role === "user" ? (
            <p className="talk-bubble">{l.text}</p>
          ) : (
            <>
              {l.text ? <Markdown text={l.text} /> : <p className="talk-wait"><span className="add-spinner" aria-hidden="true" /> Thinking…</p>}
              {l.planQuestion && l.id === last?.id && !busy && onSkipQuestion && (
                <p className="talk-question-hint">
                  Answer in the box, or{" "}
                  <button type="button" className="talk-link" onClick={() => onSkipQuestion(l)}>
                    skip and plan it anyway
                  </button>
                  .
                </p>
              )}
              {l.offerPlan && !l.streaming && l.planGoal && onPlanThis && onNotNow && (
                <PlanThisRow onPlan={() => onPlanThis(l)} onDismiss={() => onNotNow(l)} disabled={busy} />
              )}
              {!compact && !l.streaming && lines[i - 1]?.role === "user" && <BusyTimeOffer text={lines[i - 1].text} />}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
