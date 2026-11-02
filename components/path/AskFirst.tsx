"use client";

// Ask before guessing: before Tangent drafts moves off an item on a path, it
// asks what it would otherwise guess (what it is, your role, how far along:
// /api/path-intake nodeQuestions). Answers are saved onto the item by the
// generate action, so it never asks twice. Used by the plan and the map.

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export type GenerateFn = (id: string, answers?: { question: string; answer: string }[]) => void;

type ItemQuestion = { question: string; chips: string[] };

/** Before drafting off an item, ask what Tangent would otherwise guess
 *  (/api/path-intake nodeQuestions). Nothing to ask: draft straight away. */
export function useAskFirst(nodeId: string | null, onGenerate: GenerateFn) {
  const [phase, setPhase] = useState<"idle" | "checking" | "asking">("idle");
  const [questions, setQuestions] = useState<ItemQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  useEffect(() => {
    setPhase("idle");
    setQuestions([]);
    setAnswers([]);
  }, [nodeId]);

  const start = async () => {
    if (!nodeId) return;
    setPhase("checking");
    try {
      const res = await fetch("/api/path-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "nodeQuestions", nodeId }),
      });
      const data = (await res.json()) as { questions?: ItemQuestion[] };
      const qs = data.questions ?? [];
      if (qs.length === 0) {
        setPhase("idle");
        onGenerate(nodeId);
        return;
      }
      setQuestions(qs);
      setAnswers(qs.map(() => ""));
      setPhase("asking");
    } catch {
      setPhase("idle");
      onGenerate(nodeId);
    }
  };

  const submit = (skip = false) => {
    if (!nodeId) return;
    const given = skip ? [] : questions.map((q, i) => ({ question: q.question, answer: answers[i].trim() })).filter((a) => a.answer);
    setPhase("idle");
    onGenerate(nodeId, given);
  };

  return { phase, questions, answers, setAnswers, start, submit };
}

export type AskFirst = ReturnType<typeof useAskFirst>;

/** The questions, when there are any; nothing otherwise. */
export function AskFirstPanel({ ask, title }: { ask: AskFirst; title: string }) {
  if (ask.phase !== "asking") return null;
  return (
    <section className="path-ask" aria-label="What Tangent needs to know first">
      <h3>Before I suggest anything about {title}</h3>
      {ask.questions.map((q, i) => (
        <div key={q.question} className="path-ask-q">
          <p>{q.question}</p>
          {q.chips.length > 0 && (
            <div className="path-ask-chips">
              {q.chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`path-step-chip${ask.answers[i] === c ? " is-on" : ""}`}
                  onClick={() => ask.setAnswers((a) => a.map((v, j) => (j === i ? c : v)))}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <input
            className="path-ask-input"
            value={q.chips.includes(ask.answers[i]) ? "" : ask.answers[i]}
            placeholder={q.chips.length ? "Or say it in your words" : "Tell Tangent"}
            aria-label={q.question}
            onChange={(e) => ask.setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask.submit();
            }}
          />
        </div>
      ))}
      <div className="path-ask-actions">
        <button type="button" className="path-btn is-primary" onClick={() => ask.submit()} disabled={!ask.answers.some((a) => a.trim())}>
          <Sparkles size={15} aria-hidden="true" />
          Suggest moves
        </button>
        <button type="button" className="path-btn is-quiet" onClick={() => ask.submit(true)}>
          Skip, just draft
        </button>
      </div>
    </section>
  );
}
