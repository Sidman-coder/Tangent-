"use client";

// "Let Tangent get to know you": setup as a short conversation instead of a
// form. Tangent asks one thing at a time; the student taps an answer, types
// their own, or skips. Every answer becomes a remembered fact (Settings ›
// What Tangent knows) that every AI step reads, so plans and questions start
// from who the student actually is. Opens on the GET_TO_KNOW_EVENT — after
// first-run setup, from Today's nudge, or from Settings.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUp, Mic, Square, X } from "lucide-react";
import PenMark from "@/components/console/PenMark";
import { useAppState } from "@/components/AppStateProvider";
import { capacityFromAnswer } from "@/lib/capacity-answer";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import "./get-to-know-you.css";
import "./console/clarify-card.css";

export const GET_TO_KNOW_EVENT = "tangent:get-to-know";
/** Detail for GET_TO_KNOW_EVENT: "grill" skips the basics and goes straight
 *  to Tangent's own questions, for as long as the student wants. */
export type GetToKnowDetail = { mode?: "setup" | "grill" } | undefined;
/** Fired when the conversation closes, so the feature tour can follow it. */
export const GET_TO_KNOW_DONE_EVENT = "tangent:get-to-know-done";

type Category = "goal" | "commitment" | "work" | "habit" | "preference" | "general";
type Step = {
  id: string;
  /** Asked by Tangent from what it knows (app/api/grill), not the fixed set. */
  ai?: boolean;
  ask: string;
  why: string;
  chips: string[];
  multi?: boolean;
  placeholder: string;
  category: Category;
  /** How the answer is remembered: "Working toward: …". */
  remember: (answer: string) => string;
  capacity?: boolean;
};

const STEPS: Step[] = [
  {
    id: "toward",
    ask: "What are you working toward this year?",
    why: "So plans aim at something real.",
    chips: ["Better grades", "College applications", "A big project", "Getting organized"],
    multi: true,
    placeholder: "e.g. a 4.0, a robotics team, a 1500 SAT",
    category: "goal",
    remember: (a) => `Working toward: ${a}`,
  },
  {
    id: "activities",
    ask: "What do you do outside class?",
    why: "Practices and clubs take real time, so Tangent plans around them.",
    chips: ["Sports", "Robotics", "Music", "Debate", "A job", "Volunteering"],
    multi: true,
    placeholder: "e.g. robotics Tue/Thu until 6, piano lessons Saturday",
    category: "commitment",
    remember: (a) => `Activities outside class: ${a}`,
  },
  {
    id: "coming-up",
    ask: "What's coming up that matters most?",
    why: "Tangent spaces work so the big things don't sneak up.",
    chips: ["A big test", "A project deadline", "Applications", "A competition"],
    placeholder: "e.g. AP Chem final Dec 12, science fair Feb 3",
    category: "work",
    remember: (a) => `Coming up that matters: ${a}`,
  },
  {
    id: "capacity",
    ask: "On a school night, how much work can you do before you're fried?",
    why: "Tangent won't pile more than this onto one evening.",
    chips: ["About 1 hr", "About 2 hrs", "About 3 hrs", "4+ hrs"],
    placeholder: "e.g. 90 min",
    category: "habit",
    remember: (a) => `Can handle about ${a.replace(/^about\s+/i, "")} of work on a school night`,
    capacity: true,
  },
  {
    id: "best-time",
    ask: "When do you get your best work done?",
    why: "Hard things go where you're sharpest.",
    chips: ["Right after school", "Evenings", "Late at night", "Weekend mornings"],
    placeholder: "e.g. after a snack, before 9",
    category: "habit",
    remember: (a) => `Does their best work: ${a}`,
  },
  {
    id: "slip",
    ask: "What usually slips through the cracks?",
    why: "Tangent will watch for exactly that.",
    chips: ["Small assignments", "Long projects", "Studying for tests", "Starting things"],
    multi: true,
    placeholder: "e.g. reading I'm supposed to do over the weekend",
    category: "preference",
    remember: (a) => `Tends to let slip: ${a}`,
  },
];

async function remember(fact: string, category: Category) {
  await fetch("/api/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remember", fact, category }),
  }).catch(() => {});
}

export default function GetToKnowYou() {
  const { state, refresh } = useAppState();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"setup" | "grill">("setup");
  const [extra, setExtra] = useState<Step[]>([]);
  const [thinking, setThinking] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [log, setLog] = useState<{ ask: string; answer: string | null }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const capacityKnown = Boolean(state?.user.capacity);

  const base = mode === "grill" ? [] : STEPS.filter((s) => !(s.capacity && capacityKnown));
  const steps = [...base, ...extra];
  const step = steps[index];

  useEffect(() => {
    const onOpen = (e: Event) => {
      const m = (e as CustomEvent<GetToKnowDetail>).detail?.mode ?? "setup";
      setMode(m);
      setExtra([]);
      setIndex(0);
      setLog([]);
      setPicked([]);
      setText("");
      setOpen(true);
      if (m === "grill") void askMore([]);
    };
    window.addEventListener(GET_TO_KNOW_EVENT, onOpen);
    return () => window.removeEventListener(GET_TO_KNOW_EVENT, onOpen);
  }, []);

  // One more question from Tangent, aimed at what it knows least.
  const askMore = useCallback(async (asked: string[]) => {
    setThinking(true);
    try {
      const res = await fetch("/api/grill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asked }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        question?: { question: string; why: string; chips: string[]; category: Category };
      };
      if (data.ok && data.question) {
        const q = data.question;
        setExtra((x) => [
          ...x,
          {
            id: `ai-${x.length}`,
            ai: true,
            ask: q.question,
            why: q.why,
            chips: q.chips,
            placeholder: "Type or tap the mic and say it",
            category: q.category,
            remember: (a: string) => `${q.question.replace(/\?\s*$/, "")}: ${a}`,
          },
        ]);
      }
    } finally {
      setThinking(false);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    void refresh();
    window.dispatchEvent(new Event(GET_TO_KNOW_DONE_EVENT));
    // First time through: the tour follows, so they see where it all lives.
    let toured = true;
    try {
      toured = window.localStorage.getItem("tangent-tour-done") === "1";
    } catch {}
    if (!toured) window.setTimeout(() => window.dispatchEvent(new Event("tangent:tour")), 400);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const next = useCallback(
    (answer: string | null) => {
      if (!step) return;
      setLog((l) => [...l, { ask: step.ask, answer }]);
      if (answer) {
        void remember(step.remember(answer), step.category);
        if (step.capacity) {
          const weekday = capacityFromAnswer(answer);
          if (weekday) {
            void fetch("/api/capacity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weekday, weekend: Math.min(720, Math.round(weekday * 1.6)) }),
            }).catch(() => {});
          }
        }
      }
      setPicked([]);
      setText("");
      setIndex((i) => i + 1);
      // Grill mode keeps going: the next question is fetched as this one closes.
      if (mode === "grill" || step.ai) void askMore([...log.map((l) => l.ask), step.ask]);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    },
    [step, mode, log, askMore]
  );

  // Answer out loud: words fill the field as they're spoken, and the answer
  // goes when the student stops.
  const nextRef = useRef(next);
  nextRef.current = next;
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const voice = useVoiceCapture({
    live: true,
    onPartial: setText,
    onTranscript: (t) => {
      const parts = [...pickedRef.current, t.trim()].filter(Boolean);
      nextRef.current(parts.length ? parts.join(", ") : null);
    },
  });

  const submit = () => {
    const parts = [...picked, text.trim()].filter(Boolean);
    next(parts.length ? parts.join(", ") : null);
  };

  if (!open || typeof document === "undefined") return null;
  const done = index >= steps.length && !thinking;

  return createPortal(
    <div className="gtk-scrim" role="dialog" aria-modal="true" aria-labelledby="gtk-title">
      <m.div
        className="gtk-sheet"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", visualDuration: 0.35, bounce: 0 }}
      >
        <header className="gtk-head">
          <h2 id="gtk-title">{mode === "grill" ? "Grill me" : "Let Tangent get to know you"}</h2>
          <span className="gtk-progress">{mode === "grill" || step?.ai ? `${log.length} answered` : done ? "Done" : `${index + 1} of ${steps.length}`}</span>
          <button type="button" className="gtk-close" onClick={close} aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="gtk-thread">
          {log.map((l, i) => (
            <div key={i} className="gtk-turn">
              <p className="gtk-ask">{l.ask}</p>
              <p className={`gtk-answer${l.answer ? "" : " is-skipped"}`}>{l.answer ?? "Skipped"}</p>
            </div>
          ))}

          <AnimatePresence mode="wait">
            {done ? (
              <m.div key="done" className="gtk-turn" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <p className="gtk-ask">
                    Thanks. That&apos;s saved. Tangent will use it for every plan, and you can change any of it in Settings › What Tangent knows.
                  </p>
                </div>
                <div className="gtk-chips">
                  <button type="button" className="tg-chip" onClick={() => void askMore(log.map((l) => l.ask))}>
                    Keep going — ask me more
                  </button>
                </div>
              </m.div>
            ) : !step ? (
              <m.div key="thinking" className="gtk-turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <p className="gtk-why">Thinking of a good question…</p>
                </div>
              </m.div>
            ) : (
              <m.div
                key={step.id}
                className="gtk-turn is-current"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <div className="gtk-ask-row">
                  <PenMark className="gtk-mark" />
                  <div>
                    <p className="gtk-ask">{step.ask}</p>
                    <p className="gtk-why">{step.why}</p>
                  </div>
                </div>
                <div className="gtk-chips">
                  {step.chips.map((c) => {
                    const on = picked.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`tg-chip${on ? " is-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => {
                          if (step.multi) setPicked((p) => (on ? p.filter((x) => x !== c) : [...p, c]));
                          else next(c);
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="gtk-foot">
          {done || !step ? (
            <button type="button" className="gtk-primary" onClick={close}>
              Done
            </button>
          ) : (
            <>
              <form
                className="gtk-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={voice.status === "recording" ? "Listening…" : step.placeholder}
                  aria-label={step.ask}
                  autoFocus
                />
                <button
                  type="button"
                  className={`gtk-mic${voice.status === "recording" ? " is-on" : ""}`}
                  aria-label={voice.status === "recording" ? "Stop and answer" : "Answer out loud"}
                  disabled={voice.status === "transcribing"}
                  onClick={() => (voice.status === "recording" ? voice.stopRecording() : void voice.startRecording())}
                >
                  {voice.status === "recording" ? <Square size={12} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                </button>
                <button type="submit" className="gtk-send" aria-label="Answer" disabled={!text.trim() && picked.length === 0}>
                  <ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </form>
              <button type="button" className="gtk-skip" onClick={() => next(null)}>
                Skip
              </button>
              {(mode === "grill" || step.ai) && (
                <button type="button" className="gtk-skip" onClick={close}>
                  Done
                </button>
              )}
            </>
          )}
        </footer>
      </m.div>
    </div>,
    document.body
  );
}
